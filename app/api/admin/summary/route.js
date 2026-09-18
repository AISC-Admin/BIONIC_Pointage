import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';

// GET /api/admin/summary?mois=YYYY-MM
// Totaux par salarie pour le mois, utilises par les cartes du tableau de bord.
export async function GET(request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();

  const { searchParams } = new URL(request.url);
  const mois = searchParams.get('mois') || new Date().toISOString().slice(0, 7);

  const { rows } = await sql`
    SELECT e.id AS employee_id, e.nom, e.prenom,
           COALESCE(SUM(s.duree_heures), 0) AS total_heures,
           COALESCE(SUM(s.montant), 0) AS total_montant,
           COUNT(s.id) AS nb_vacations
    FROM employees e
    LEFT JOIN shifts s
      ON s.employee_id = e.id AND to_char(s.shift_date, 'YYYY-MM') = ${mois}
    WHERE e.actif = true
    GROUP BY e.id, e.nom, e.prenom
    ORDER BY e.nom, e.prenom;
  `;

  const totalGeneral = rows.reduce(
    (acc, r) => {
      acc.heures += Number(r.total_heures);
      acc.montant += Number(r.total_montant);
      return acc;
    },
    { heures: 0, montant: 0 }
  );

  return NextResponse.json({
    mois,
    parEmploye: rows.map((r) => ({
      employeeId: r.employee_id,
      nom: r.nom,
      prenom: r.prenom,
      totalHeures: Number(r.total_heures),
      totalMontant: Number(r.total_montant),
      nbVacations: Number(r.nb_vacations)
    })),
    totalGeneral
  });
}
