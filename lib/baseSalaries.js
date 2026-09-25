import { sql } from '@/lib/db';

// "Base de donnees salaries" : repertoire independant des comptes de
// pointage (table `employees`). On peut y ficher des candidats, des extras
// ou des salaries, avec leurs coordonnees, leurs disponibilites saisonnieres,
// un CV et une photo. Les fichiers (CV, photo) sont stockes sur Vercel Blob :
// seule leur URL est gardee ici.
let pret = false;

export async function ensureBaseSalariesSchema() {
  if (pret) return;
  await sql`
    CREATE TABLE IF NOT EXISTS base_salaries (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT,
      date_naissance DATE,
      telephone TEXT,
      email TEXT,
      ville TEXT,
      pays TEXT,
      poste TEXT,
      langues TEXT,
      taux_horaire NUMERIC(10,2),
      dispo_ete BOOLEAN NOT NULL DEFAULT false,
      dispo_hiver BOOLEAN NOT NULL DEFAULT false,
      cv_texte TEXT,
      cv_url TEXT,
      cv_nom TEXT,
      photo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // Colonne ajoutee apres coup : pour une table deja creee.
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS pays TEXT;`;
  // Pre-entretien d'embauche : une fiche est soit un "postulant" (tableau
  // des candidats a recevoir en entretien), soit un profil "base" (inclus
  // dans la base complete apres entretien). Les fiches existantes sont "base".
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'base';`;
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS nationalite TEXT;`;
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS date_postulation DATE;`;
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS date_entretien DATE;`;
  // Suivi du recrutement dans le tableau pre-entretien (cases a cocher) :
  // mail envoye au postulant, entretien passe, valide par le recruteur.
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS mail_envoye BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS entretien_passe BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS valide_recruteur BOOLEAN NOT NULL DEFAULT false;`;
  // Lien vers le compte de pointage (table employees) cree a partir de ce
  // profil via le bouton "Ajouter comme salarie".
  await sql`ALTER TABLE base_salaries ADD COLUMN IF NOT EXISTS employee_id INTEGER;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_base_salaries_nom ON base_salaries(lower(nom));`;
  pret = true;
}

// Champs modifiables depuis le formulaire, avec normalisation : chaines
// vides => null, taux en nombre, cases a cocher en booleens.
export function nettoyerFiche(data) {
  const txt = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };
  const taux = data.taux_horaire === '' || data.taux_horaire == null ? null : Number(data.taux_horaire);
  return {
    nom: txt(data.nom),
    prenom: txt(data.prenom),
    date_naissance: txt(data.date_naissance),
    telephone: txt(data.telephone),
    email: txt(data.email),
    ville: txt(data.ville),
    pays: txt(data.pays),
    nationalite: txt(data.nationalite),
    statut: data.statut === 'postulant' ? 'postulant' : 'base',
    date_postulation: txt(data.date_postulation),
    date_entretien: txt(data.date_entretien),
    poste: txt(data.poste),
    langues: txt(data.langues),
    taux_horaire: Number.isFinite(taux) && taux >= 0 ? taux : null,
    dispo_ete: !!data.dispo_ete,
    dispo_hiver: !!data.dispo_hiver,
    cv_texte: txt(data.cv_texte),
    cv_url: txt(data.cv_url),
    cv_nom: txt(data.cv_nom),
    photo_url: txt(data.photo_url)
  };
}
