'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { upload } from '@vercel/blob/client';

// Devis emis aux clients : saisie des elements (lignes, montants), depot du
// PDF, et suivi du statut En cours / Valide / Refuse. Un devis valide est
// inscrit dans la facturation du mois choisi (onglet Facturation).

const STATUTS = {
  en_cours: { libelle: 'En cours', classe: 'pill-warning' },
  valide: { libelle: 'Valide', classe: 'pill-success' },
  refuse: { libelle: 'Refuse', classe: 'pill-danger' }
};

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatEuros(v) {
  if (v === null || v === undefined || v === '') return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

function formatDate(iso) {
  if (!iso) return '';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

function libelleMoisCourt(m) {
  if (!m) return '';
  const [a, mm] = m.split('-');
  return new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function nomFichierSur(nom) {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function lienFichier(url) {
  return url ? `/api/admin/base-salaries/fichier?url=${encodeURIComponent(url)}` : '';
}

function num(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function devisVide(mois) {
  return {
    numero: '',
    client_id: '',
    site_id: '',
    societe_id: '',
    objet: '',
    date_emission: aujourdhui(),
    date_validite: '',
    tva_taux: '20',
    lignes: [{ designation: '', quantite: '1', prix_unitaire: '' }],
    statut: 'en_cours',
    mois_facturation: mois,
    pdf_url: '',
    pdf_nom: '',
    notes: ''
  };
}

export default function Devis({ mois, onChange }) {
  const [devis, setDevis] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [societes, setSocietes] = useState([]);
  const [form, setForm] = useState(null); // null = formulaire ferme
  const [editionId, setEditionId] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiPdf, setEnvoiPdf] = useState(false);
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    const [rd, rc] = await Promise.all([fetch('/api/admin/devis'), fetch('/api/admin/clients')]);
    if (rd.ok) setDevis((await rd.json()).devis);
    if (rc.ok) {
      const c = await rc.json();
      setClients(c.clients);
      setSites(c.sites);
      setSocietes(c.societes || []);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function maj(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
  }

  function majLigne(i, champ, valeur) {
    setForm((f) => ({ ...f, lignes: f.lignes.map((l, k) => (k === i ? { ...l, [champ]: valeur } : l)) }));
  }

  const totalHT = form ? Math.round(form.lignes.reduce((a, l) => a + num(l.quantite) * num(l.prix_unitaire), 0) * 100) / 100 : 0;
  const tva = form ? Math.round(totalHT * num(form.tva_taux)) / 100 : 0;

  function nouveau() {
    setEditionId(null);
    setForm(devisVide(mois));
    setMessage(null);
  }

  function modifier(d) {
    setEditionId(d.id);
    setForm({
      ...devisVide(mois),
      ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === null ? '' : v])),
      tva_taux: String(d.tva_taux ?? 20),
      lignes: (d.lignes?.length ? d.lignes : [{ designation: '', quantite: 1, prix_unitaire: '' }]).map((l) => ({
        designation: l.designation || '',
        quantite: String(l.quantite ?? ''),
        prix_unitaire: String(l.prix_unitaire ?? '')
      })),
      mois_facturation: d.mois_facturation || mois
    });
    setMessage(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function choisirClient(id) {
    const c = clients.find((x) => String(x.id) === String(id));
    setForm((f) => ({ ...f, client_id: id, site_id: '', societe_id: c?.societe_id ? String(c.societe_id) : f.societe_id }));
  }

  async function deposerPdf(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (fichier.type !== 'application/pdf') {
      setMessage({ type: 'error', texte: 'Le devis doit etre un fichier PDF.' });
      return;
    }
    if (fichier.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', texte: 'Le PDF depasse 10 Mo.' });
      return;
    }
    setEnvoiPdf(true);
    try {
      const blob = await upload(`clients/devis/${form.client_id || 'sans-client'}/${nomFichierSur(fichier.name)}`, fichier, {
        access: 'private',
        handleUploadUrl: '/api/admin/base-salaries/upload'
      });
      setForm((f) => ({ ...f, pdf_url: blob.url, pdf_nom: fichier.name }));
    } catch (err) {
      setMessage({ type: 'error', texte: `PDF non envoye : ${err.message}` });
    } finally {
      setEnvoiPdf(false);
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch(editionId ? `/api/admin/devis/${editionId}` : '/api/admin/devis', {
      method: editionId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ type: 'error', texte: d.erreur || 'Enregistrement impossible.' });
      return;
    }
    setMessage({ type: 'success', texte: editionId ? 'Devis mis a jour.' : `Devis ${d.numero} enregistre.` });
    setForm(null);
    setEditionId(null);
    await charger();
    onChange?.();
  }

  async function changerStatut(d, statut) {
    let moisFact = d.mois_facturation || mois;
    if (statut === 'valide') {
      const ok = window.confirm(
        `Valider le devis ${d.numero} (${formatEuros(d.montant_ht)} HT) ?\nIl sera inscrit dans la facturation de ${libelleMoisCourt(moisFact)}.`
      );
      if (!ok) return;
    }
    const res = await fetch(`/api/admin/devis/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statutSeul: true, statut, mois_facturation: moisFact })
    });
    if (!res.ok) {
      const x = await res.json().catch(() => ({}));
      setMessage({ type: 'error', texte: x.erreur || 'Statut non modifie.' });
      return;
    }
    await charger();
    onChange?.();
  }

  async function supprimer(d) {
    if (!window.confirm(`Supprimer le devis ${d.numero} et son PDF ?`)) return;
    const res = await fetch(`/api/admin/devis/${d.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editionId === d.id) setForm(null);
      await charger();
      onChange?.();
    }
  }

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return devis.filter((d) => {
      if (filtre && d.statut !== filtre) return false;
      if (!q) return true;
      return [d.numero, d.client, d.site, d.objet].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [devis, filtre, recherche]);

  const compte = (s) => devis.filter((d) => d.statut === s).length;
  const sitesClient = form ? sites.filter((s) => String(s.client_id) === String(form.client_id)) : [];

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="card-title" style={{ margin: 0 }}>
          Devis clients
        </div>
        {!form && (
          <button className="btn btn-primary btn-sm" onClick={nouveau}>
            Nouveau devis
          </button>
        )}
      </div>

      {message && <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>{message.texte}</div>}

      {form && (
        <form onSubmit={enregistrer} className="entry" style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{editionId ? `Modifier le devis ${form.numero}` : 'Nouveau devis'}</div>
          <div className="row">
            <div className="field">
              <label>Client *</label>
              <select value={form.client_id} onChange={(e) => choisirClient(e.target.value)} required>
                <option value="">Choisir...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.raison_sociale}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Site (optionnel)</label>
              <select value={form.site_id} onChange={(e) => maj('site_id', e.target.value)} disabled={!form.client_id}>
                <option value="">Tous / aucun</option>
                {sitesClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Societe emettrice</label>
              <select value={form.societe_id} onChange={(e) => maj('societe_id', e.target.value)}>
                <option value="">Par defaut du client</option>
                {societes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>N° de devis</label>
              <input type="text" placeholder="Auto (DEV-AAAA-NNN)" value={form.numero} onChange={(e) => maj('numero', e.target.value)} />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Objet</label>
              <input type="text" placeholder="Prestation evenementielle..." value={form.objet} onChange={(e) => maj('objet', e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Date d&apos;emission</label>
              <input type="date" value={form.date_emission} onChange={(e) => maj('date_emission', e.target.value)} />
            </div>
            <div className="field">
              <label>Valable jusqu&apos;au</label>
              <input type="date" value={form.date_validite} onChange={(e) => maj('date_validite', e.target.value)} />
            </div>
            <div className="field">
              <label>TVA (%)</label>
              <input type="number" step="0.1" min="0" value={form.tva_taux} onChange={(e) => maj('tva_taux', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Elements du devis</label>
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th style={{ width: 90 }}>Quantite</th>
                    <th style={{ width: 130 }}>Prix unit. HT</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Total HT</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.lignes.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <input type="text" value={l.designation} onChange={(e) => majLigne(i, 'designation', e.target.value)} style={{ padding: '7px 9px' }} />
                      </td>
                      <td>
                        <input type="text" inputMode="decimal" value={l.quantite} onChange={(e) => majLigne(i, 'quantite', e.target.value)} style={{ padding: '7px 9px', textAlign: 'right' }} />
                      </td>
                      <td>
                        <input type="text" inputMode="decimal" value={l.prix_unitaire} onChange={(e) => majLigne(i, 'prix_unitaire', e.target.value)} style={{ padding: '7px 9px', textAlign: 'right' }} />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatEuros(num(l.quantite) * num(l.prix_unitaire))}</td>
                      <td>
                        {form.lignes.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setForm((f) => ({ ...f, lignes: f.lignes.filter((_, k) => k !== i) }))}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex-between" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setForm((f) => ({ ...f, lignes: [...f.lignes, { designation: '', quantite: '1', prix_unitaire: '' }] }))}
              >
                + Ajouter une ligne
              </button>
              <div style={{ textAlign: 'right', fontSize: 14 }}>
                Total HT <b>{formatEuros(totalHT)}</b> · TVA {formatEuros(tva)} · <b>TTC {formatEuros(totalHT + tva)}</b>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Devis PDF</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-secondary btn-sm" style={{ margin: 0, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, color: 'var(--text)' }}>
                  {envoiPdf ? 'Envoi...' : form.pdf_url ? 'Remplacer le PDF' : 'Deposer le PDF'}
                  <input type="file" accept="application/pdf,.pdf" onChange={deposerPdf} disabled={envoiPdf} hidden />
                </label>
                {form.pdf_url && (
                  <a href={lienFichier(form.pdf_url)} target="_blank" rel="noreferrer" className="small">
                    {form.pdf_nom || 'Voir le PDF'}
                  </a>
                )}
              </div>
            </div>
            <div className="field">
              <label>Statut</label>
              <select value={form.statut} onChange={(e) => maj('statut', e.target.value)}>
                {Object.entries(STATUTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.libelle}
                  </option>
                ))}
              </select>
            </div>
            {form.statut === 'valide' && (
              <div className="field">
                <label>Facture sur le mois</label>
                <input type="month" value={form.mois_facturation} onChange={(e) => maj('mois_facturation', e.target.value)} required />
              </div>
            )}
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => maj('notes', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={envoiPdf}>
              {editionId ? 'Enregistrer les modifications' : 'Enregistrer le devis'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setForm(null);
                setEditionId(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} style={{ maxWidth: 230 }}>
          <option value="">Tous les statuts ({devis.length})</option>
          {Object.entries(STATUTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.libelle} ({compte(k)})
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Rechercher (n°, client, site, objet)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
      </div>

      {liste.length === 0 ? (
        <div className="empty-state">Aucun devis.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Objet</th>
                <th>Emis le</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th>Statut</th>
                <th>PDF</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.numero}</td>
                  <td>
                    {d.client}
                    {d.site && <div className="muted small">{d.site}</div>}
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{d.objet}</td>
                  <td>{formatDate(d.date_emission)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatEuros(d.montant_ht)}</td>
                  <td>
                    <span className={`pill ${STATUTS[d.statut]?.classe || ''}`}>{STATUTS[d.statut]?.libelle || d.statut}</span>
                    {d.statut === 'valide' && d.mois_facturation && (
                      <div className="muted small">Facture : {libelleMoisCourt(d.mois_facturation)}</div>
                    )}
                  </td>
                  <td>
                    {d.pdf_url ? (
                      <a href={lienFichier(d.pdf_url)} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {d.statut !== 'en_cours' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => changerStatut(d, 'en_cours')}>
                          En cours
                        </button>
                      )}
                      {d.statut !== 'valide' && (
                        <button className="btn btn-primary btn-sm" onClick={() => changerStatut(d, 'valide')}>
                          Valider
                        </button>
                      )}
                      {d.statut !== 'refuse' && (
                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => changerStatut(d, 'refuse')}>
                          Refuser
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => modifier(d)}>
                        Modifier
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => supprimer(d)}>
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
