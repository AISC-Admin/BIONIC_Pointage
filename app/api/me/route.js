import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { requireEmployeeSession } from '@/lib/auth';

// Profil complet du salarie connecte (au-dela de nom/prenom, deja dans la
// session) : relu depuis la base pour rester a jour si le responsable a
// modifie la fiche depuis la connexion.
export async function GET() {
  const session = await requireEmployeeSession();
  if (!session) {
    return NextResponse.json({ erreur: 'Non connecte.' }, { status: 401 });
  }
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, nom, prenom
    FROM employees WHERE id = ${session.employeeId};
  `;
  if (!rows[0]) {
    return NextResponse.json({ erreur: 'Salarie introuvable.' }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
