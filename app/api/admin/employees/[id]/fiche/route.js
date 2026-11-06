import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';

// POST { poste } : cree la fiche "Base de donnees salaries" d'un salarie qui
// n'en a pas encore (compte cree directement dans l'onglet Salaries), pour
// pouvoir lui ajouter un book photos. Renvoie l'id de la fiche.
export async function POST(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { poste } = await request.json();

  const { rows: existe } = await sql`SELECT id FROM base_salaries WHERE employee_id = ${id} ORDER BY id LIMIT 1;`;
  if (existe.length > 0) {
    if (poste) await sql`UPDATE base_salaries SET poste = ${String(poste).trim()}, updated_at = now() WHERE id = ${existe[0].id};`;
    return NextResponse.json({ fiche_id: existe[0].id });
  }
  const { rows: emp } = await sql`
    SELECT nom, prenom, taux_horaire, to_char(date_naissance, 'YYYY-MM-DD') AS date_naissance FROM employees WHERE id = ${id};
  `;
  if (emp.length === 0) return NextResponse.json({ erreur: 'Salarie introuvable.' }, { status: 404 });
  const e = emp[0];
  const { rows } = await sql`
    INSERT INTO base_salaries (nom, prenom, date_naissance, taux_horaire, poste, statut, employee_id)
    VALUES (${e.nom}, ${e.prenom}, ${e.date_naissance}, ${e.taux_horaire}, ${poste ? String(poste).trim() : null}, 'base', ${id})
    RETURNING id;
  `;
  return NextResponse.json({ fiche_id: rows[0].id });
}
