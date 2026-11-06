import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureClientsSchema } from '@/lib/clients';
import { nettoyerDevis, urlPdfValide } from '@/lib/devis';


export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureClientsSchema();
  const { rows } = await sql`
    SELECT d.id, d.numero, d.client_id, d.site_id, d.societe_id, d.objet,
           to_char(d.date_emission, 'YYYY-MM-DD') AS date_emission,
           to_char(d.date_validite, 'YYYY-MM-DD') AS date_validite,
           d.lignes, d.montant_ht::float AS montant_ht, d.tva_taux::float AS tva_taux,
           d.statut, d.date_statut, d.mois_facturation, d.pdf_url, d.pdf_nom, d.notes, d.created_at,
           c.raison_sociale AS client, st.nom AS site, so.nom AS societe
    FROM devis d
    JOIN clients c ON c.id = d.client_id
    LEFT JOIN sites st ON st.id = d.site_id
    LEFT JOIN societes_facturation so ON so.id = d.societe_id
    ORDER BY d.date_emission DESC NULLS LAST, d.id DESC;
  `;
  return NextResponse.json({ devis: rows });
}

export async function POST(request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureClientsSchema();
  const d = nettoyerDevis(await request.json());
  if (!d.client_id) return NextResponse.json({ erreur: 'Le client est obligatoire.' }, { status: 400 });
  if (!urlPdfValide(d.pdf_url)) return NextResponse.json({ erreur: 'Fichier PDF non autorise.' }, { status: 400 });
  if (d.statut === 'valide' && !d.mois_facturation) {
    return NextResponse.json({ erreur: 'Indiquez le mois de facturation du devis valide.' }, { status: 400 });
  }
  // Numero automatique DEV-AAAA-NNN si non saisi.
  let numero = d.numero;
  if (!numero) {
    const annee = (d.date_emission || new Date().toISOString()).slice(0, 4);
    const { rows } = await sql`SELECT COUNT(*)::int AS nb FROM devis WHERE numero LIKE ${`DEV-${annee}-%`};`;
    numero = `DEV-${annee}-${String(rows[0].nb + 1).padStart(3, '0')}`;
  }
  const { rows } = await sql`
    INSERT INTO devis (numero, client_id, site_id, societe_id, objet, date_emission, date_validite, lignes,
      montant_ht, tva_taux, statut, date_statut, mois_facturation, pdf_url, pdf_nom, notes)
    VALUES (${numero}, ${d.client_id}, ${d.site_id}, ${d.societe_id}, ${d.objet}, ${d.date_emission}, ${d.date_validite},
      ${JSON.stringify(d.lignes)}::jsonb, ${d.montant_ht}, ${d.tva_taux}, ${d.statut}, now(),
      ${d.mois_facturation}, ${d.pdf_url}, ${d.pdf_nom}, ${d.notes})
    RETURNING id, numero;
  `;
  return NextResponse.json(rows[0]);
}

