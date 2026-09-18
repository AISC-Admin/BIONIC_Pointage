import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();

  const { rows } = await sql`
    SELECT id, nom, prenom, taux_horaire, actif, created_at
    FROM employees
    ORDER BY nom, prenom;
  `;
  return NextResponse.json({ employees: rows });
}

export async function POST(request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();

  const { nom, prenom, code, taux_horaire } = await request.json();
  if (!nom || !code) {
    return NextResponse.json({ erreur: 'Nom et code requis.' }, { status: 400 });
  }
  if (String(code).trim().length < 4) {
    return NextResponse.json({ erreur: 'Le code doit faire au moins 4 caracteres.' }, { status: 400 });
  }
  const tauxPersonnel =
    taux_horaire !== undefined && taux_horaire !== null && taux_horaire !== ''
      ? Number(taux_horaire)
      : null;
  if (tauxPersonnel !== null && (Number.isNaN(tauxPersonnel) || tauxPersonnel <= 0)) {
    return NextResponse.json({ erreur: 'Le taux horaire doit etre un nombre positif.' }, { status: 400 });
  }

  const codeHash = await bcrypt.hash(String(code).trim(), 10);
  const { rows } = await sql`
    INSERT INTO employees (nom, prenom, code_hash, taux_horaire)
    VALUES (${nom.trim()}, ${prenom ? prenom.trim() : null}, ${codeHash}, ${tauxPersonnel})
    RETURNING id, nom, prenom, taux_horaire, actif, created_at;
  `;
  return NextResponse.json({ employee: rows[0] });
}
