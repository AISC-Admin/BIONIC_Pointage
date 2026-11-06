import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql, ensureSchema } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureSchema();
  await ensureBaseSalariesSchema();

  // date_entree/date_sortie sont castees en texte (to_char) plutot que
  // renvoyees comme DATE brute : selon le driver Postgres et le fuseau
  // horaire du serveur, une DATE peut etre reinterpretee comme un instant et
  // decalee d'un jour a la conversion JSON. En texte "YYYY-MM-DD", aucune
  // ambiguite.
  // fiche_* : fiche "Base de donnees salaries" reliee (poste, photo
  // principale, nombre de photos du book), si elle existe.
  const { rows } = await sql`
    SELECT e.id, e.nom, e.prenom, e.taux_horaire, e.actif, e.created_at,
           to_char(e.date_entree, 'YYYY-MM-DD') AS date_entree,
           to_char(e.date_sortie, 'YYYY-MM-DD') AS date_sortie,
           f.id AS fiche_id, f.poste AS fiche_poste, f.photo_url AS fiche_photo_url,
           (SELECT COUNT(*)::int FROM base_salaries_photos p WHERE p.fiche_id = f.id) AS nb_photos
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT id, poste, photo_url FROM base_salaries b WHERE b.employee_id = e.id ORDER BY b.id LIMIT 1
    ) f ON true
    ORDER BY e.nom, e.prenom;
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
