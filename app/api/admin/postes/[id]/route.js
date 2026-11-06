import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';

export async function PATCH(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();
  const { id } = await params;
  const { nom, taux_horaire, actif } = await request.json();

  if (nom !== undefined) {
    const propre = String(nom).trim();
    if (!propre) return NextResponse.json({ erreur: 'Le nom du poste est obligatoire.' }, { status: 400 });
    try {
      await sql`UPDATE postes SET nom = ${propre} WHERE id = ${id};`;
    } catch {
      return NextResponse.json({ erreur: 'Un autre poste porte deja ce nom.' }, { status: 409 });
    }
  }
  if (taux_horaire !== undefined) {
    const taux = Number(String(taux_horaire).replace(',', '.'));
    if (!Number.isFinite(taux) || taux <= 0) {
      return NextResponse.json({ erreur: 'Le taux horaire doit etre un nombre positif.' }, { status: 400 });
    }
    // Le nouveau taux s'applique aux vacations saisies ensuite : les
    // vacations deja enregistrees gardent le taux et le montant du jour.
    await sql`UPDATE postes SET taux_horaire = ${taux} WHERE id = ${id};`;
  }
  if (actif !== undefined) await sql`UPDATE postes SET actif = ${actif} WHERE id = ${id};`;

  const { rows } = await sql`SELECT id, nom, taux_horaire, actif FROM postes WHERE id = ${id};`;
  return NextResponse.json({ poste: rows[0] });
}

export async function DELETE(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();
  const { id } = await params;
  try {
    await sql`DELETE FROM postes WHERE id = ${id};`;
  } catch {
    return NextResponse.json(
      { erreur: 'Ce poste a deja des vacations enregistrees : desactivez-le plutot que de le supprimer.' },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
