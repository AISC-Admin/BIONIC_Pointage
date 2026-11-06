import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';
import { MAX_PHOTOS_BOOK } from '@/lib/postesBook';

// GET : book photos d'une fiche (ordre d'ajout).
export async function GET(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { rows: fiche } = await sql`SELECT photo_url FROM base_salaries WHERE id = ${id};`;
  if (fiche.length === 0) return NextResponse.json({ erreur: 'Fiche introuvable.' }, { status: 404 });
  const { rows } = await sql`
    SELECT id, url, nom, created_at FROM base_salaries_photos
    WHERE fiche_id = ${id} ORDER BY ordre, id;
  `;
  return NextResponse.json({ photos: rows, photo_principale: fiche[0].photo_url });
}

// POST : enregistre des photos deja envoyees sur Vercel Blob par le
// navigateur. Corps : { photos: [{ url, nom }] }.
export async function POST(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { id } = await params;
  const { photos } = await request.json();
  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ erreur: 'Aucune photo.' }, { status: 400 });
  }
  for (const p of photos) {
    let cible;
    try {
      cible = new URL(p.url);
    } catch {
      return NextResponse.json({ erreur: 'URL invalide.' }, { status: 400 });
    }
    if (!cible.hostname.endsWith('.blob.vercel-storage.com') || !cible.pathname.startsWith('/base-salaries/')) {
      return NextResponse.json({ erreur: 'Fichier non autorise.' }, { status: 400 });
    }
  }
  const { rows: fiche } = await sql`SELECT photo_url FROM base_salaries WHERE id = ${id};`;
  if (fiche.length === 0) return NextResponse.json({ erreur: 'Fiche introuvable.' }, { status: 404 });
  const { rows: compte } = await sql`
    SELECT COUNT(*)::int AS nb, coalesce(MAX(ordre), 0)::int AS ordre FROM base_salaries_photos WHERE fiche_id = ${id};
  `;
  if (compte[0].nb + photos.length > MAX_PHOTOS_BOOK) {
    return NextResponse.json({ erreur: `Maximum ${MAX_PHOTOS_BOOK} photos par profil.` }, { status: 400 });
  }
  let ordre = compte[0].ordre;
  for (const p of photos) {
    ordre += 1;
    await sql`
      INSERT INTO base_salaries_photos (fiche_id, url, nom, ordre)
      VALUES (${id}, ${p.url}, ${p.nom ? String(p.nom).slice(0, 200) : null}, ${ordre});
    `;
  }
  // Pas encore de photo principale : la premiere photo du book le devient.
  if (!fiche[0].photo_url) {
    await sql`UPDATE base_salaries SET photo_url = ${photos[0].url}, updated_at = now() WHERE id = ${id};`;
  }
  return NextResponse.json({ ok: true });
}
