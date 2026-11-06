import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { ensureBaseSalariesSchema } from '@/lib/baseSalaries';

// PATCH { principale: true } : cette photo du book devient la photo
// principale de la fiche (celle affichee dans les listes).
export async function PATCH(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { photoId } = await params;
  const { principale } = await request.json();
  const { rows } = await sql`SELECT fiche_id, url FROM base_salaries_photos WHERE id = ${photoId};`;
  if (rows.length === 0) return NextResponse.json({ erreur: 'Photo introuvable.' }, { status: 404 });
  if (principale) {
    const { rows: avant } = await sql`SELECT photo_url FROM base_salaries WHERE id = ${rows[0].fiche_id};`;
    await sql`UPDATE base_salaries SET photo_url = ${rows[0].url}, updated_at = now() WHERE id = ${rows[0].fiche_id};`;
    // L'ancienne photo principale, si elle n'est pas dans le book, entre
    // dans le book pour ne pas etre perdue.
    const ancienne = avant[0]?.photo_url;
    if (ancienne && ancienne !== rows[0].url) {
      const { rows: dansBook } = await sql`
        SELECT 1 FROM base_salaries_photos WHERE fiche_id = ${rows[0].fiche_id} AND url = ${ancienne} LIMIT 1;
      `;
      if (dansBook.length === 0) {
        await sql`
          INSERT INTO base_salaries_photos (fiche_id, url, nom, ordre) VALUES (${rows[0].fiche_id}, ${ancienne}, 'Ancienne photo principale', 0);
        `;
      }
    }
  }
  return NextResponse.json({ ok: true });
}

// DELETE : retire la photo du book et du stockage. Si c'etait la photo
// principale, la photo suivante du book prend sa place.
export async function DELETE(request, { params }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ erreur: 'Acces refuse.' }, { status: 403 });
  await ensureBaseSalariesSchema();
  const { photoId } = await params;
  const { rows } = await sql`DELETE FROM base_salaries_photos WHERE id = ${photoId} RETURNING fiche_id, url;`;
  if (rows.length === 0) return NextResponse.json({ ok: true });
  const { fiche_id, url } = rows[0];
  const { rows: fiche } = await sql`SELECT photo_url FROM base_salaries WHERE id = ${fiche_id};`;
  if (fiche[0]?.photo_url === url) {
    const { rows: suivante } = await sql`
      SELECT url FROM base_salaries_photos WHERE fiche_id = ${fiche_id} ORDER BY ordre, id LIMIT 1;
    `;
    await sql`UPDATE base_salaries SET photo_url = ${suivante[0]?.url || null}, updated_at = now() WHERE id = ${fiche_id};`;
  }
  try {
    await del(url);
  } catch (e) {
    console.error('Suppression Blob impossible :', e);
  }
  return NextResponse.json({ ok: true });
}
