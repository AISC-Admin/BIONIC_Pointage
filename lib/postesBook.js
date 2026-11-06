// Postes "book" : profils qui necessitent plusieurs photos (mannequins,
// modeles, hotesses, performers). Utilisable cote navigateur et serveur.
export const POSTES_BOOK = [
  'Mannequin',
  'Modele',
  'Hôtesse Event',
  'Hôtesse Accueil',
  'Hôtesse Promotion Club',
  'Performer - Danse'
];

const MOTS_CLES = ['mannequin', 'modele', 'hotesse', 'performer', 'danse'];

export function normaliser(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Vrai si le poste (saisie libre) correspond a un poste "book", quelle que
// soit l'orthographe : "Modèle", "hotesse d'accueil", "Performer danse"...
export function estPosteBook(poste) {
  const p = normaliser(poste);
  return !!p && MOTS_CLES.some((m) => p.includes(m));
}

export const MAX_PHOTOS_BOOK = 40;
