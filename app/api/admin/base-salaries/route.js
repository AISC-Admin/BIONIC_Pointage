import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema, nettoyerFiche } from '@/lib/baseSalaries';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { rows } = await sql`
    SELECT id, nom, prenom, to_char(date_naissance, 'YYYY-MM-DD') AS date_naissance,
      telephone, email, ville, pays, nationalite, statut,
      to_char(date_postulation, 'YYYY-MM-DD') AS date_postulation,
      to_char(date_entretien, 'YYYY-MM-DD') AS date_entretien,
      poste, langues, taux_horaire, dispo_ete, dispo_hiver,
      cv_texte, cv_url, cv_nom, photo_url, created_at, updated_at
    FROM base_salaries
    ORDER BY lower(nom), lower(coalesce(prenom, ''));
  `;
  return NextResponse.json({ fiches: rows });
}

export async function POST(request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const f = nettoyerFiche(await request.json());
  if (!f.nom) return NextResponse.json({ erreur: 'Le nom est obligatoire.' }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO base_salaries (nom, prenom, date_naissance, telephone, email, ville, pays, poste, langues,
      taux_horaire, dispo_ete, dispo_hiver, cv_texte, cv_url, cv_nom, photo_url,
      nationalite, statut, date_postulation, date_entretien)
    VALUES (${f.nom}, ${f.prenom}, ${f.date_naissance}, ${f.telephone}, ${f.email}, ${f.ville}, ${f.pays}, ${f.poste},
      ${f.langues}, ${f.taux_horaire}, ${f.dispo_ete}, ${f.dispo_hiver}, ${f.cv_texte}, ${f.cv_url},
      ${f.cv_nom}, ${f.photo_url}, ${f.nationalite}, ${f.statut}, ${f.date_postulation}, ${f.date_entretien})
    RETURNING id;
  `;
  return NextResponse.json({ id: rows[0].id });
}
