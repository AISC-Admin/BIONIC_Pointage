'use client';

import { useCallback, useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { MAX_PHOTOS_BOOK } from '@/lib/postesBook';

// Book photos d'une fiche de la base salaries (mannequins, modeles,
// hotesses, performers...) : ajout de plusieurs photos d'un coup, choix de
// la photo principale, suppression, et visionneuse plein ecran.

function lienFichier(url) {
  return url ? `/api/admin/base-salaries/fichier?url=${encodeURIComponent(url)}` : '';
}

function nomFichierSur(nom) {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Redimensionne (1600 px max, JPEG 85 %) : qualite suffisante pour un book,
// fichiers legers pour un affichage rapide.
async function compresser(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 1600;
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    const base = fichier.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const st = {
  grille: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 },
  vignette: (principale) => ({
    position: 'relative',
    aspectRatio: '3 / 4',
    borderRadius: 4,
    overflow: 'hidden',
    background: 'var(--surface-2)',
    border: principale ? '2px solid var(--blue-500)' : '1px solid var(--border)',
    cursor: 'zoom-in'
  }),
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  badge: {
    position: 'absolute', top: 6, left: 6, background: 'var(--blue-500)', color: '#fff',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase'
  },
  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: 4, background: 'linear-gradient(transparent, rgba(5,7,10,0.65))' },
  mini: { border: 'none', background: 'rgba(255,255,255,0.92)', color: 'var(--text)', fontSize: 11, fontWeight: 600, padding: '3px 6px', borderRadius: 3, cursor: 'pointer' },
  voile: { position: 'fixed', inset: 0, background: 'rgba(5,7,10,0.88)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  grand: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 },
  fleche: { position: 'fixed', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 28, width: 48, height: 64, cursor: 'pointer', borderRadius: 4 },
  fermer: { position: 'fixed', top: 16, right: 16, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 22, width: 44, height: 44, cursor: 'pointer', borderRadius: 4 }
};

export default function GaleriePhotos({ ficheId, onChange, titre = 'Book photos' }) {
  const [photos, setPhotos] = useState([]);
  const [principale, setPrincipale] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(null); // { fait, total }
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState(null); // index affiche en grand

  const charger = useCallback(async () => {
    const res = await fetch(`/api/admin/base-salaries/${ficheId}/photos`);
    let d = null;
    if (res.ok) {
      d = await res.json();
      setPhotos(d.photos);
      setPrincipale(d.photo_principale);
    }
    setChargement(false);
    return d;
  }, [ficheId]);

  // Recharge et previent le parent (nouvelle photo principale eventuelle).
  async function rafraichir() {
    const d = await charger();
    onChange?.(d?.photo_principale ?? null);
  }

  useEffect(() => {
    charger();
  }, [charger]);

  // Navigation clavier dans la visionneuse.
  useEffect(() => {
    if (vue === null) return;
    function touche(e) {
      if (e.key === 'Escape') setVue(null);
      if (e.key === 'ArrowRight') setVue((v) => (v + 1) % photos.length);
      if (e.key === 'ArrowLeft') setVue((v) => (v - 1 + photos.length) % photos.length);
    }
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [vue, photos.length]);

  async function ajouter(e) {
    const fichiers = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (fichiers.length === 0) return;
    if (photos.length + fichiers.length > MAX_PHOTOS_BOOK) {
      setErreur(`Maximum ${MAX_PHOTOS_BOOK} photos par profil (${photos.length} deja).`);
      return;
    }
    setErreur(null);
    setEnvoi({ fait: 0, total: fichiers.length });
    const envoyees = [];
    try {
      for (const f of fichiers) {
        const c = await compresser(f);
        const blob = await upload(`base-salaries/book/${ficheId}/${nomFichierSur(c.name)}`, c, {
          access: 'private',
          handleUploadUrl: '/api/admin/base-salaries/upload'
        });
        envoyees.push({ url: blob.url, nom: f.name });
        setEnvoi((x) => ({ ...x, fait: x.fait + 1 }));
      }
    } catch (err) {
      setErreur(`Envoi interrompu : ${err.message}`);
    }
    if (envoyees.length > 0) {
      const res = await fetch(`/api/admin/base-salaries/${ficheId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: envoyees })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErreur(d.erreur || 'Photos non enregistrees.');
      }
    }
    setEnvoi(null);
    await rafraichir();
  }

  async function definirPrincipale(p) {
    await fetch(`/api/admin/base-salaries/photos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principale: true })
    });
    await rafraichir();
  }

  async function supprimer(p) {
    if (!window.confirm('Supprimer cette photo du book ?')) return;
    await fetch(`/api/admin/base-salaries/photos/${p.id}`, { method: 'DELETE' });
    await rafraichir();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          {titre} ({photos.length}/{MAX_PHOTOS_BOOK})
        </div>
        <label className="btn btn-primary btn-sm" style={{ margin: 0, cursor: envoi ? 'wait' : 'pointer', textTransform: 'none', letterSpacing: 0, color: '#fff' }}>
          {envoi ? `Envoi ${envoi.fait}/${envoi.total}...` : 'Ajouter des photos'}
          <input type="file" accept="image/*" multiple onChange={ajouter} disabled={!!envoi} hidden />
        </label>
      </div>
      {erreur && <div className="alert alert-error">{erreur}</div>}
      {chargement ? (
        <div className="muted small">Chargement...</div>
      ) : photos.length === 0 ? (
        <div className="muted small">Aucune photo. Vous pouvez en selectionner plusieurs a la fois.</div>
      ) : (
        <div style={st.grille}>
          {photos.map((p, i) => {
            const estPrincipale = p.url === principale;
            return (
              <div key={p.id} style={st.vignette(estPrincipale)} onClick={() => setVue(i)} title={p.nom || ''}>
                <img src={lienFichier(p.url)} alt="" loading="lazy" style={st.img} />
                {estPrincipale && <span style={st.badge}>Principale</span>}
                <div style={st.actions} onClick={(e) => e.stopPropagation()}>
                  {!estPrincipale ? (
                    <button type="button" style={st.mini} onClick={() => definirPrincipale(p)} title="Utiliser comme photo principale">
                      ★
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" style={{ ...st.mini, color: 'var(--danger)' }} onClick={() => supprimer(p)} title="Supprimer">
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vue !== null && photos[vue] && (
        <div style={st.voile} onClick={() => setVue(null)}>
          <img src={lienFichier(photos[vue].url)} alt="" style={st.grand} onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                style={{ ...st.fleche, left: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setVue((v) => (v - 1 + photos.length) % photos.length);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                style={{ ...st.fleche, right: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setVue((v) => (v + 1) % photos.length);
                }}
              >
                ›
              </button>
            </>
          )}
          <button type="button" style={st.fermer} onClick={() => setVue(null)}>
            ×
          </button>
          <div style={{ position: 'fixed', bottom: 16, left: 0, right: 0, textAlign: 'center', color: '#c7d0dc', fontSize: 13 }}>
            {vue + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
