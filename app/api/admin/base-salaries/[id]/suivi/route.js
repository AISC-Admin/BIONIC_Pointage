import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';

// PATCH : met a jour une case de suivi du tableau pre-entretien
// (mail_envoye, entretien_passe, valide_recruteur) sans toucher au reste
// de la fiche. Corps attendu : { champ: 'mail_envoye', valeur: true }.
const CHAMPS = ['mail_envoye', 'entretien_passe', 'valide_recruteur'];

export async function PATCH(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { champ, valeur } = await request.json();
  if (!CHAMPS.includes(champ)) return NextResponse.json({ erreur: 'Champ inconnu.' }, { status: 400 });
  const v = !!valeur;

  let res;
  if (champ === 'mail_envoye') {
    res = await sql`UPDATE base_salaries SET mail_envoye = ${v}, updated_at = now() WHERE id = ${id} RETURNING id;`;
  } else if (champ === 'entretien_passe') {
    res = await sql`UPDATE base_salaries SET entretien_passe = ${v}, updated_at = now() WHERE id = ${id} RETURNING id;`;
  } else {
    res = await sql`UPDATE base_salaries SET valide_recruteur = ${v}, updated_at = now() WHERE id = ${id} RETURNING id;`;
  }
  if (res.rows.length === 0) return NextResponse.json({ erreur: 'Fiche introuvable.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
