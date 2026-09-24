import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { requireAdminSession } from '@/lib/auth';

// Envoi direct navigateur -> Vercel Blob (evite la limite de 4,5 Mo des
// fonctions Vercel). Cette route ne fait que delivrer un jeton d'envoi
// temporaire, et uniquement a un responsable connecte.
// Necessite la variable BLOB_READ_WRITE_TOKEN, ajoutee automatiquement
// quand on cree un store Blob dans l'onglet Storage du projet Vercel.
const TYPES_AUTORISES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export async function POST(request) {
  const body = await request.json();

  try {
    const reponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await requireAdminSession();
        if (!session) throw new Error('Acces refuse.');
        if (!pathname.startsWith('base-salaries/')) throw new Error('Chemin non autorise.');
        return {
          allowedContentTypes: TYPES_AUTORISES,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      // Rien a faire a la fin de l'envoi : le navigateur enregistre lui-meme
      // l'URL du fichier dans la fiche.
      onUploadCompleted: async () => {}
    });
    return NextResponse.json(reponse);
  } catch (e) {
    return NextResponse.json({ erreur: e.message || 'Envoi impossible.' }, { status: 400 });
  }
}
