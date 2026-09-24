'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { upload } from '@vercel/blob/client';

// Onglet "Base de donnees salaries" de l'espace responsable : repertoire des
// profils (candidats, extras, salaries) avec coordonnees, poste, langues,
// taux horaire, disponibilites ete/hiver, CV (fichier + texte libre) et photo.

function ficheVide() {
  return {
    nom: '',
    prenom: '',
    date_naissance: '',
    telephone: '',
    email: '',
    ville: '',
    pays: '',
    poste: '',
    langues: '',
    taux_horaire: '',
    dispo_ete: false,
    dispo_hiver: false,
    cv_texte: '',
    cv_url: '',
    cv_nom: '',
    photo_url: ''
  };
}

function formatEuros(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(valeur);
}

function formatDate(iso) {
  if (!iso) return null;
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

function age(iso) {
  if (!iso) return null;
  const n = new Date(iso);
  const auj = new Date();
  let a = auj.getFullYear() - n.getFullYear();
  const m = auj.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < n.getDate())) a -= 1;
  return a;
}

// Redimensionne et compresse la photo dans le navigateur avant l'envoi
// (600 px max, JPEG) : fichiers legers et affichage rapide dans la liste.
async function compresserPhoto(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 600;
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function nomFichierSur(nom) {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Les fichiers sont prives : on passe par la route qui verifie la session.
function lienFichier(url) {
  return url ? `/api/admin/base-salaries/fichier?url=${encodeURIComponent(url)}` : '';
}

// Suggestions pour le champ Pays (saisie libre possible).
const PAYS = [
  'France', 'Estonie', 'Espagne', 'Belgique', 'Suisse', 'Luxembourg', 'Monaco', 'Italie',
  'Allemagne', 'Portugal', 'Royaume-Uni', 'Irlande', 'Pays-Bas', 'Finlande', 'Lettonie',
  'Lituanie', 'Pologne', 'Roumanie', 'Maroc', 'Algerie', 'Tunisie', 'Senegal',
  "Cote d'Ivoire", 'Cameroun', 'Canada', 'Etats-Unis'
];

function libelleDispo(f) {
  if (f.dispo_ete && f.dispo_hiver) return 'Ete + Hiver';
  if (f.dispo_ete) return 'Ete';
  if (f.dispo_hiver) return 'Hiver';
  return null;
}

const styles = {
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    background: 'var(--navy-700)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    color: 'var(--text-muted)'
  },
  photoForm: {
    width: 96,
    height: 96,
    borderRadius: 12,
    objectFit: 'cover',
    background: 'var(--navy-700)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: 12,
    flexShrink: 0
  },
  check: { display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 14, cursor: 'pointer', color: 'var(--text)', letterSpacing: 0, fontWeight: 500 }
};

export default function BaseSalaries({ postes = [] }) {
  const [fiches, setFiches] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState(ficheVide());
  const [editionId, setEditionId] = useState(null);
  const [message, setMessage] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [envoiCv, setEnvoiCv] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreDispo, setFiltreDispo] = useState('');
  const [ouverte, setOuverte] = useState(null);
  const formRef = useRef(null);

  const charger = useCallback(async () => {
    const res = await fetch('/api/admin/base-salaries');
    if (res.ok) setFiches((await res.json()).fiches);
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function maj(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
  }

  async function envoyerFichier(fichier, dossier) {
    const blob = await upload(`base-salaries/${dossier}/${nomFichierSur(fichier.name)}`, fichier, {
      access: 'private',
      handleUploadUrl: '/api/admin/base-salaries/upload'
    });
    return blob.url;
  }

  async function choisirPhoto(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setEnvoiPhoto(true);
    setMessage(null);
    try {
      const compressee = await compresserPhoto(fichier);
      const url = await envoyerFichier(compressee, 'photos');
      maj('photo_url', url);
    } catch (err) {
      setMessage({ type: 'error', texte: `Photo non envoyee : ${err.message}` });
    } finally {
      setEnvoiPhoto(false);
    }
  }

  async function choisirCv(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (fichier.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', texte: 'Le CV depasse 10 Mo.' });
      return;
    }
    setEnvoiCv(true);
    setMessage(null);
    try {
      const url = await envoyerFichier(fichier, 'cv');
      setForm((f) => ({ ...f, cv_url: url, cv_nom: fichier.name }));
    } catch (err) {
      setMessage({ type: 'error', texte: `CV non envoye : ${err.message}` });
    } finally {
      setEnvoiCv(false);
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    setEnregistrement(true);
    setMessage(null);
    try {
      const res = await fetch(editionId ? `/api/admin/base-salaries/${editionId}` : '/api/admin/base-salaries', {
        method: editionId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', texte: data.erreur || 'Enregistrement impossible.' });
        return;
      }
      setMessage({ type: 'success', texte: editionId ? 'Fiche mise a jour.' : 'Fiche ajoutee.' });
      setForm(ficheVide());
      setEditionId(null);
      charger();
    } finally {
      setEnregistrement(false);
    }
  }

  function modifier(f) {
    setEditionId(f.id);
    setForm({
      ...ficheVide(),
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === null ? '' : v])),
      dispo_ete: !!f.dispo_ete,
      dispo_hiver: !!f.dispo_hiver
    });
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function annuler() {
    setEditionId(null);
    setForm(ficheVide());
    setMessage(null);
  }

  async function supprimer(f) {
    if (!window.confirm(`Supprimer la fiche de ${f.prenom || ''} ${f.nom} (CV et photo compris) ?`)) return;
    const res = await fetch(`/api/admin/base-salaries/${f.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editionId === f.id) annuler();
      charger();
    }
  }

  const fichesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return fiches.filter((f) => {
      if (filtreDispo === 'ete' && !f.dispo_ete) return false;
      if (filtreDispo === 'hiver' && !f.dispo_hiver) return false;
      if (filtreDispo === 'deux' && !(f.dispo_ete && f.dispo_hiver)) return false;
      if (!q) return true;
      return [f.nom, f.prenom, f.ville, f.pays, f.poste, f.langues, f.email, f.telephone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [fiches, recherche, filtreDispo]);

  const lesDeux = form.dispo_ete && form.dispo_hiver;

  return (
    <>
      <div className="card" ref={formRef}>
        <div className="card-title">{editionId ? 'Modifier la fiche' : 'Ajouter une fiche'}</div>

        {message && (
          <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>{message.texte}</div>
        )}

        <form onSubmit={enregistrer}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            {form.photo_url ? (
              <img src={lienFichier(form.photo_url)} alt="Photo" style={styles.photoForm} />
            ) : (
              <div style={styles.photoForm}>Photo</div>
            )}
            <div>
              <label className="btn btn-secondary btn-sm" style={{ display: 'inline-block', marginBottom: 6, cursor: 'pointer' }}>
                {envoiPhoto ? 'Envoi...' : form.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/*" onChange={choisirPhoto} disabled={envoiPhoto} hidden />
              </label>
              {form.photo_url && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => maj('photo_url', '')}>
                  Retirer
                </button>
              )}
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Nom *</label>
              <input type="text" value={form.nom} onChange={(e) => maj('nom', e.target.value)} required />
            </div>
            <div className="field">
              <label>Prenom</label>
              <input type="text" value={form.prenom} onChange={(e) => maj('prenom', e.target.value)} />
            </div>
            <div className="field">
              <label>Date de naissance</label>
              <input type="date" value={form.date_naissance} onChange={(e) => maj('date_naissance', e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Telephone</label>
              <input type="tel" value={form.telephone} onChange={(e) => maj('telephone', e.target.value)} />
            </div>
            <div className="field">
              <label>Adresse mail</label>
              <input type="email" value={form.email} onChange={(e) => maj('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Ville</label>
              <input type="text" value={form.ville} onChange={(e) => maj('ville', e.target.value)} />
            </div>
            <div className="field">
              <label>Pays</label>
              <input type="text" list="bs-pays" value={form.pays} onChange={(e) => maj('pays', e.target.value)} />
              <datalist id="bs-pays">
                {PAYS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Poste</label>
              <input type="text" list="bs-postes" value={form.poste} onChange={(e) => maj('poste', e.target.value)} />
              <datalist id="bs-postes">
                {postes.map((p) => (
                  <option key={p.id} value={p.nom} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Langues parlees</label>
              <input
                type="text"
                placeholder="Francais, Anglais..."
                value={form.langues}
                onChange={(e) => maj('langues', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Taux horaire (EUR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.taux_horaire}
                onChange={(e) => maj('taux_horaire', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Disponibilites</label>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <label style={styles.check}>
                <input type="checkbox" checked={form.dispo_ete} onChange={(e) => maj('dispo_ete', e.target.checked)} />
                Dispo l'ete
              </label>
              <label style={styles.check}>
                <input type="checkbox" checked={form.dispo_hiver} onChange={(e) => maj('dispo_hiver', e.target.checked)} />
                Dispo l'hiver
              </label>
              <label style={styles.check}>
                <input
                  type="checkbox"
                  checked={lesDeux}
                  onChange={(e) => setForm((f) => ({ ...f, dispo_ete: e.target.checked, dispo_hiver: e.target.checked }))}
                />
                Les deux
              </label>
            </div>
          </div>

          <div className="field">
            <label>CV</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <label className="btn btn-secondary btn-sm" style={{ display: 'inline-block', margin: 0, cursor: 'pointer' }}>
                {envoiCv ? 'Envoi...' : form.cv_url ? 'Remplacer le fichier' : 'Joindre un CV (PDF, Word, image)'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={choisirCv}
                  disabled={envoiCv}
                  hidden
                />
              </label>
              {form.cv_url && (
                <>
                  <a href={lienFichier(form.cv_url)} target="_blank" rel="noreferrer" className="small">
                    {form.cv_nom || 'Voir le CV'}
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setForm((f) => ({ ...f, cv_url: '', cv_nom: '' }))}
                  >
                    Retirer
                  </button>
                </>
              )}
            </div>
            <textarea
              rows={5}
              placeholder="Complement : experiences, diplomes, certifications, remarques..."
              value={form.cv_texte}
              onChange={(e) => maj('cv_texte', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={enregistrement || envoiCv || envoiPhoto}>
              {enregistrement ? 'Enregistrement...' : editionId ? 'Enregistrer les modifications' : 'Ajouter la fiche'}
            </button>
            {editionId && (
              <button type="button" className="btn btn-secondary" onClick={annuler}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          Base de donnees salaries ({fichesFiltrees.length}
          {fichesFiltrees.length !== fiches.length ? ` / ${fiches.length}` : ''})
        </div>

        <div className="row" style={{ marginBottom: 8 }}>
          <div className="field">
            <input
              type="search"
              placeholder="Rechercher (nom, ville, pays, poste, langue...)"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
          <div className="field">
            <select value={filtreDispo} onChange={(e) => setFiltreDispo(e.target.value)}>
              <option value="">Toutes disponibilites</option>
              <option value="ete">Dispo l'ete</option>
              <option value="hiver">Dispo l'hiver</option>
              <option value="deux">Les deux</option>
            </select>
          </div>
        </div>

        {chargement ? (
          <div className="muted small">Chargement...</div>
        ) : fichesFiltrees.length === 0 ? (
          <div className="empty-state">Aucune fiche.</div>
        ) : (
          <div className="list">
            {fichesFiltrees.map((f) => {
              const dispo = libelleDispo(f);
              const a = age(f.date_naissance);
              const detail = ouverte === f.id;
              return (
                <div key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="list-row" style={{ borderBottom: 'none', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                      {f.photo_url ? (
                        <img src={lienFichier(f.photo_url)} alt="" style={styles.avatar} />
                      ) : (
                        <div style={styles.avatar}>{(f.prenom?.[0] || '') + (f.nom?.[0] || '')}</div>
                      )}
                      <div className="list-row-main">
                        <div className="list-row-title">
                          {f.prenom} {f.nom}
                          {dispo && (
                            <span className="pill pill-success" style={{ marginLeft: 8 }}>
                              {dispo}
                            </span>
                          )}
                        </div>
                        <div className="list-row-sub">
                          {[f.poste, [f.ville, f.pays].filter(Boolean).join(', '), formatEuros(f.taux_horaire) && `${formatEuros(f.taux_horaire)}/h`]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        <div className="list-row-sub">
                          {[f.telephone, f.email].filter(Boolean).join(' · ')}
                        </div>
                        {f.langues && <div className="list-row-sub">Langues : {f.langues}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setOuverte(detail ? null : f.id)}>
                        {detail ? 'Fermer' : 'Details'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => modifier(f)}>
                        Modifier
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => supprimer(f)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                  {detail && (
                    <div className="small" style={{ padding: '0 0 14px 60px', lineHeight: 1.6 }}>
                      {f.date_naissance && (
                        <div>
                          Ne(e) le {formatDate(f.date_naissance)}
                          {a !== null ? ` (${a} ans)` : ''}
                        </div>
                      )}
                      {f.cv_url && (
                        <div>
                          CV :{' '}
                          <a href={lienFichier(f.cv_url)} target="_blank" rel="noreferrer">
                            {f.cv_nom || 'ouvrir'}
                          </a>
                        </div>
                      )}
                      {f.cv_texte && <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{f.cv_texte}</div>}
                      {!f.date_naissance && !f.cv_url && !f.cv_texte && <div className="muted">Aucun detail.</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
