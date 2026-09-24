import { get } from '@vercel/blob';
import { requireAdminSession } from '@/lib/auth';

// Les CV et photos sont des donnees personnelles : ils sont stockes en
// "private" sur Vercel Blob (aucun lien public). Cette route les relit cote
// serveur et ne les renvoie qu'a un responsable connecte.
export async function GET(request) {
  const session = await requireAdminSession();
  if (!session) return new Response('Acces refuse.', { status: 403 });

  const url = new URL(request.url).searchParams.get('url');
  let cible;
  try {
    cible = new URL(url);
  } catch {
    return new Response('URL invalide.', { status: 400 });
  }
  if (!cible.hostname.endsWith('.blob.vercel-storage.com') || !cible.pathname.startsWith('/base-salaries/')) {
    return new Response('Fichier non autorise.', { status: 400 });
  }

  const resultat = await get(url, { access: 'private' });
  if (!resultat || resultat.statusCode !== 200) return new Response('Fichier introuvable.', { status: 404 });

  const nom = decodeURIComponent(cible.pathname.split('/').pop() || 'fichier');
  return new Response(resultat.stream, {
    headers: {
      'Content-Type': resultat.blob.contentType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${nom.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
