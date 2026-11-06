import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureClientsSchema } from '@/lib/clients';
import { nettoyerDevis, urlPdfValide, STATUTS_DEVIS } from '@/lib/devis';

async function supprimerBlob(url) {
  if (!url) return;
  try {
    await del(url);
  } catch (e) {
    console.error('Suppression Blob impossible :', e);
  }
}

// PATCH : soit changement de statut seul ({ statut, mois_facturation }),
// soit mise a jour complete du devis (corps du formulaire).
export async function PATCH(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureClientsSchema();
  const { id } = await params;
  const body = await request.json();
  const { rows: avant } = await sql`SELECT pdf_url, statut, mois_facturation FROM devis WHERE id = ${id};`;
  if (avant.length === 0) return NextResponse.json({ erreur: 'Devis introuvable.' }, { status: 404 });

  if (body.statutSeul) {
    if (!STATUTS_DEVIS.includes(body.statut)) return NextResponse.json({ erreur: 'Statut inconnu.' }, { status: 400 });
    const mois = /^\d{4}-\d{2}$/.test(body.mois_facturation || '') ? body.mois_facturation : avant[0].mois_facturation;
    if (body.statut === 'valide' && !mois) {
      return NextResponse.json({ erreur: 'Indiquez le mois de facturation du devis valide.' }, { status: 400 });
    }
    await sql`
      UPDATE devis SET statut = ${body.statut}, mois_facturation = ${mois}, date_statut = now(), updated_at = now()
      WHERE id = ${id};
    `;
    return NextResponse.json({ ok: true });
  }

  const d = nettoyerDevis(body);
  if (!d.client_id) return NextResponse.json({ erreur: 'Le client est obligatoire.' }, { status: 400 });
  if (!d.numero) return NextResponse.json({ erreur: 'Le numero du devis est obligatoire.' }, { status: 400 });
  if (!urlPdfValide(d.pdf_url)) return NextResponse.json({ erreur: 'Fichier PDF non autorise.' }, { status: 400 });
  if (d.statut === 'valide' && !d.mois_facturation) {
    return NextResponse.json({ erreur: 'Indiquez le mois de facturation du devis valide.' }, { status: 400 });
  }
  const statutChange = d.statut !== avant[0].statut;
  await sql`
    UPDATE devis SET numero = ${d.numero}, client_id = ${d.client_id}, site_id = ${d.site_id}, societe_id = ${d.societe_id},
      objet = ${d.objet}, date_emission = ${d.date_emission}, date_validite = ${d.date_validite},
      lignes = ${JSON.stringify(d.lignes)}::jsonb, montant_ht = ${d.montant_ht}, tva_taux = ${d.tva_taux},
      statut = ${d.statut}, mois_facturation = ${d.mois_facturation}, pdf_url = ${d.pdf_url}, pdf_nom = ${d.pdf_nom},
      notes = ${d.notes}, updated_at = now(),
      date_statut = CASE WHEN ${statutChange} THEN now() ELSE date_statut END
    WHERE id = ${id};
  `;
  if (avant[0].pdf_url && avant[0].pdf_url !== d.pdf_url) await supprimerBlob(avant[0].pdf_url);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureClientsSchema();
  const { id } = await params;
  const { rows } = await sql`DELETE FROM devis WHERE id = ${id} RETURNING pdf_url;`;
  if (rows.length > 0) await supprimerBlob(rows[0].pdf_url);
  return NextResponse.json({ ok: true });
}
