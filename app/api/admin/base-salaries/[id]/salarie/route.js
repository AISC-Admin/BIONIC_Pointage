import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';

// POST : cree un compte de pointage (table employees) a partir d'un profil
// de la base salaries, une fois son dossier valide. Corps : { code }.
// Le nom, le prenom, la date de naissance et le taux horaire sont repris de
// la fiche ; la date d'entree est fixee a aujourd'hui.
export async function POST(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { code } = await request.json();

  const codePropre = String(code || '').trim();
  if (codePropre.length < 4) {
    return NextResponse.json({ erreur: 'Le code doit faire au moins 4 caracteres.' }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, nom, prenom, to_char(date_naissance, 'YYYY-MM-DD') AS date_naissance, taux_horaire, employee_id
    FROM base_salaries WHERE id = ${id};
  `;
  const fiche = rows[0];
  if (!fiche) return NextResponse.json({ erreur: 'Fiche introuvable.' }, { status: 404 });

  if (fiche.employee_id) {
    const { rows: existe } = await sql`SELECT id FROM employees WHERE id = ${fiche.employee_id};`;
    if (existe.length > 0) {
      return NextResponse.json({ erreur: 'Ce profil a deja un compte salarie.' }, { status: 409 });
    }
  }

  const taux = fiche.taux_horaire !== null && Number(fiche.taux_horaire) > 0 ? Number(fiche.taux_horaire) : null;
  const codeHash = await bcrypt.hash(codePropre, 10);
  const { rows: cree } = await sql`
    INSERT INTO employees (nom, prenom, code_hash, taux_horaire, date_naissance, date_entree)
    VALUES (${fiche.nom}, ${fiche.prenom}, ${codeHash}, ${taux}, ${fiche.date_naissance}, CURRENT_DATE)
    RETURNING id;
  `;
  const employeeId = cree[0].id;
  await sql`UPDATE base_salaries SET employee_id = ${employeeId}, updated_at = now() WHERE id = ${id};`;

  return NextResponse.json({ ok: true, employee_id: employeeId });
}
