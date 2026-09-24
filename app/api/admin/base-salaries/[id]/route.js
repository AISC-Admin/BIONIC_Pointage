import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema, nettoyerFiche } from '@/lib/baseSalaries';

// Supprime un fichier Blob devenu inutile (remplace ou fiche supprimee).
// Une erreur ici ne doit pas bloquer l'enregistrement de la fiche.
async function supprimerFichiers(urls) {
  const aSupprimer = urls.filter(Boolean);
  if (aSupprimer.length === 0) return;
  try {
    await del(aSupprimer);
  } catch (e) {
    console.error('Suppression Blob impossible :', e);
  }
}

export async function PATCH(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const f = nettoyerFiche(await request.json());
  if (!f.nom) return NextResponse.json({ erreur: 'Le nom est obligatoire.' }, { status: 400 });

  const { rows: avant } = await sql`SELECT cv_url, photo_url FROM base_salaries WHERE id = ${id};`;
  if (avant.length === 0) return NextResponse.json({ erreur: 'Fiche introuvable.' }, { status: 404 });

  await sql`
    UPDATE base_salaries SET
      nom = ${f.nom}, prenom = ${f.prenom}, date_naissance = ${f.date_naissance},
      telephone = ${f.telephone}, email = ${f.email}, ville = ${f.ville}, poste = ${f.poste},
      langues = ${f.langues}, taux_horaire = ${f.taux_horaire}, dispo_ete = ${f.dispo_ete},
      dispo_hiver = ${f.dispo_hiver}, cv_texte = ${f.cv_texte}, cv_url = ${f.cv_url},
      cv_nom = ${f.cv_nom}, photo_url = ${f.photo_url}, updated_at = now()
    WHERE id = ${id};
  `;

  const anciens = avant[0];
  await supprimerFichiers([
    anciens.cv_url !== f.cv_url ? anciens.cv_url : null,
    anciens.photo_url !== f.photo_url ? anciens.photo_url : null
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { rows } = await sql`DELETE FROM base_salaries WHERE id = ${id} RETURNING cv_url, photo_url;`;
  if (rows.length > 0) await supprimerFichiers([rows[0].cv_url, rows[0].photo_url]);
  return NextResponse.json({ ok: true });
}
