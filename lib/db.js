import { neon } from '@neondatabase/serverless';

// DATABASE_URL est la variable posee automatiquement par l'integration
// Neon de Vercel (POSTGRES_URL reste dispo pour compatibilite avec
// d'anciens templates : on la prend en repli). La connexion est creee au
// premier usage reel (jamais au chargement du module) pour que `next build`
// reussisse meme avant que la base ne soit branchee au projet.
let sqlClient = null;

function getSql() {
  if (sqlClient) return sqlClient;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "Aucune base de donnees connectee : ajoutez l'integration Neon a ce projet Vercel (onglet Storage) puis redeployez."
    );
  }
  // fullResults: true fait que chaque appel `sql\`...\`` renvoie
  // { rows, rowCount, ... } au lieu d'un simple tableau, ce qui garde le
  // meme usage que sur les autres clients Postgres (const { rows } = ...).
  sqlClient = neon(connectionString, { fullResults: true });
  return sqlClient;
}

// Proxy tagged-template : permet de continuer a ecrire `sql\`...\`` partout
// dans le code comme avec un client classique, tout en initialisant la
// vraie connexion seulement a ce moment-la.
export function sql(strings, ...values) {
  return getSql()(strings, ...values);
}

// Cree les tables si elles n'existent pas encore. Appelee au debut de
// chaque route API : sans etat serveur persistant (Vercel est serverless),
// c'est la facon la plus simple de garantir que le schema existe, sans
// etape d'installation manuelle a faire dans la console Postgres.
let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT,
      code_hash TEXT NOT NULL,
      taux_horaire NUMERIC(10,2),
      actif BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // Ajoute la colonne si la table existait deja avant cette fonctionnalite
  // (deploiement existant qui se met a jour).
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS taux_horaire NUMERIC(10,2);`;

  await sql`
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL UNIQUE,
      actif BOOLEAN NOT NULL DEFAULT true
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS postes (
      id SERIAL PRIMARY KEY,
      nom TEXT NOT NULL UNIQUE,
      taux_horaire NUMERIC(10,2) NOT NULL,
      actif BOOLEAN NOT NULL DEFAULT true
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      site_id INTEGER NOT NULL REFERENCES sites(id),
      poste_id INTEGER NOT NULL REFERENCES postes(id),
      shift_date DATE NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT NOT NULL,
      duree_heures NUMERIC(6,2) NOT NULL,
      taux_horaire NUMERIC(10,2) NOT NULL,
      montant NUMERIC(10,2) NOT NULL,
      valide BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);`;

  schemaReady = true;
}

// Duree en heures entre deux horaires "HH:MM". Gere les vacations de nuit
// (heure de fin plus petite que l'heure de debut => on ajoute 24h).
export function calculerDureeHeures(heureDebut, heureFin) {
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}
