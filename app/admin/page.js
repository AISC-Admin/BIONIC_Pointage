'use client';

import { useEffect, useState, useCallback } from 'react';
import { Brand } from '../components/Brand';

const MOIS_LABELS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

function libelleMois(mois) {
  const [annee, m] = mois.split('-').map(Number);
  return `${MOIS_LABELS[m - 1]} ${annee}`;
}

function decalerMois(mois, delta) {
  const [annee, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(annee, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatEuros(valeur) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(valeur || 0);
}

const ONGLETS = [
  { id: 'vacations', label: 'Vacations' },
  { id: 'employees', label: 'Salaries' },
  { id: 'sites', label: 'Sites' },
  { id: 'postes', label: 'Postes' },
  { id: 'rapport', label: 'Rapport' }
];

export default function AdminPage() {
  const [chargement, setChargement] = useState(true);
  const [connecte, setConnecte] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [erreurConnexion, setErreurConnexion] = useState('');
  const [connexionEnCours, setConnexionEnCours] = useState(false);

  const [onglet, setOnglet] = useState('vacations');
  const [mois, setMois] = useState(moisCourant());

  const [summary, setSummary] = useState(null);
  const [vacations, setVacations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]);
  const [postes, setPostes] = useState([]);
  const [filtreEmploye, setFiltreEmploye] = useState('');
  const [filtreSite, setFiltreSite] = useState('');

  const verifierSession = useCallback(async () => {
    const res = await fetch(`/api/admin/summary?mois=${moisCourant()}`);
    setConnecte(res.ok);
    if (res.ok) setSummary(await res.json());
    setChargement(false);
  }, []);

  useEffect(() => {
    verifierSession();
  }, [verifierSession]);

  const chargerTout = useCallback(async () => {
    const params = new URLSearchParams({ mois });
    if (filtreEmploye) params.set('employee_id', filtreEmploye);
    if (filtreSite) params.set('site_id', filtreSite);

    const [rSummary, rVac, rEmp, rSites, rPostes] = await Promise.all([
      fetch(`/api/admin/summary?mois=${mois}`),
      fetch(`/api/admin/shifts?${params.toString()}`),
      fetch('/api/admin/employees'),
      fetch('/api/admin/sites'),
      fetch('/api/admin/postes')
    ]);
    if (rSummary.ok) setSummary(await rSummary.json());
    if (rVac.ok) setVacations((await rVac.json()).vacations);
    if (rEmp.ok) setEmployees((await rEmp.json()).employees);
    if (rSites.ok) setSites((await rSites.json()).sites);
    if (rPostes.ok) setPostes((await rPostes.json()).postes);
  }, [mois, filtreEmploye, filtreSite]);

  useEffect(() => {
    if (connecte) chargerTout();
  }, [connecte, chargerTout]);

  async function connexion(e) {
    e.preventDefault();
    setErreurConnexion('');
    setConnexionEnCours(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: motDePasse })
      });
      if (!res.ok) {
        const data = await res.json();
        setErreurConnexion(data.erreur || 'Connexion impossible.');
        return;
      }
      setConnecte(true);
    } finally {
      setConnexionEnCours(false);
    }
  }

  async function deconnexion() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setConnecte(false);
  }

  async function toggleValide(id, valide) {
    await fetch(`/api/admin/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valide })
    });
    chargerTout();
  }

  async function supprimerVacation(id) {
    await fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' });
    chargerTout();
  }

  async function exporterExcel(portee) {
    const url = portee === 'mois' ? `/api/admin/export?mois=${mois}` : '/api/admin/export';
    window.location.href = url;
  }

  // --- Salaries ---
  const [nouvNom, setNouvNom] = useState('');
  const [nouvPrenom, setNouvPrenom] = useState('');
  const [nouvCode, setNouvCode] = useState('');
  const [nouvTauxPerso, setNouvTauxPerso] = useState('');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [codeReset, setCodeReset] = useState({});
  const [tauxEdit, setTauxEdit] = useState({});

  async function ajouterEmploye(e) {
    e.preventDefault();
    setAjoutEnCours(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: nouvNom,
          prenom: nouvPrenom,
          code: nouvCode,
          taux_horaire: nouvTauxPerso
        })
      });
      if (res.ok) {
        setNouvNom('');
        setNouvPrenom('');
        setNouvCode('');
        setNouvTauxPerso('');
        chargerTout();
      }
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function toggleEmployeActif(id, actif) {
    await fetch(`/api/admin/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif })
    });
    chargerTout();
  }

  async function reinitialiserCode(id) {
    const nouveauCode = codeReset[id];
    if (!nouveauCode || nouveauCode.length < 4) return;
    await fetch(`/api/admin/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nouveauCode })
    });
    setCodeReset((c) => ({ ...c, [id]: '' }));
    chargerTout();
  }

  async function enregistrerTauxPerso(id) {
    const valeurBrute = tauxEdit[id];
    // Champ vide envoye explicitement => efface le taux personnel (le
    // poste refait foi). Sinon on envoie le nombre saisi.
    const tauxHoraire = valeurBrute === undefined || valeurBrute === '' ? null : valeurBrute;
    await fetch(`/api/admin/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tauxHoraire })
    });
    setTauxEdit((c) => ({ ...c, [id]: undefined }));
    chargerTout();
  }

  // --- Rapport (tableau croise mois x site pour un salarie) ---
  const [rapportEmploye, setRapportEmploye] = useState('');
  const [rapportData, setRapportData] = useState(null);
  const [rapportChargement, setRapportChargement] = useState(false);

  useEffect(() => {
    if (!rapportEmploye) {
      setRapportData(null);
      return;
    }
    setRapportChargement(true);
    fetch(`/api/admin/reports/employee?employee_id=${rapportEmploye}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRapportData(data))
      .finally(() => setRapportChargement(false));
  }, [rapportEmploye]);

  // --- Sites ---
  const [nouvSite, setNouvSite] = useState('');
  async function ajouterSite(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nouvSite })
    });
    if (res.ok) {
      setNouvSite('');
      chargerTout();
    }
  }
  async function toggleSiteActif(id, actif) {
    await fetch(`/api/admin/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif })
    });
    chargerTout();
  }
  async function supprimerSite(id) {
    await fetch(`/api/admin/sites/${id}`, { method: 'DELETE' });
    chargerTout();
  }

  // --- Postes ---
  const [nouvPoste, setNouvPoste] = useState('');
  const [nouvTaux, setNouvTaux] = useState('');
  async function ajouterPoste(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/postes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nouvPoste, taux_horaire: nouvTaux })
    });
    if (res.ok) {
      setNouvPoste('');
      setNouvTaux('');
      chargerTout();
    }
  }
  async function togglePosteActif(id, actif) {
    await fetch(`/api/admin/postes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif })
    });
    chargerTout();
  }
  async function supprimerPoste(id) {
    await fetch(`/api/admin/postes/${id}`, { method: 'DELETE' });
    chargerTout();
  }

  if (chargement) {
    return (
      <div className="page">
        <div className="center-loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!connecte) {
    return (
      <div className="page">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-brand">
              <Brand subtitle="Espace responsable" />
            </div>
            {erreurConnexion && <div className="alert alert-error">{erreurConnexion}</div>}
            <form onSubmit={connexion}>
              <div className="field">
                <label htmlFor="pwd">Mot de passe</label>
                <input
                  id="pwd"
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={connexionEnCours}>
                {connexionEnCours ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <Brand subtitle="Espace responsable" />
          <button className="btn btn-ghost" onClick={deconnexion}>
            Deconnexion
          </button>
        </div>
      </div>

      <div className="shell section-gap">
        <div className="flex-between">
          <div className="tabs" style={{ flex: 1 }}>
            {ONGLETS.map((o) => (
              <div
                key={o.id}
                className={`tab ${onglet === o.id ? 'active' : ''}`}
                onClick={() => setOnglet(o.id)}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setMois((m) => decalerMois(m, -1))}>
              &larr;
            </button>
            <div style={{ fontWeight: 700 }}>{libelleMois(mois)}</div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMois((m) => decalerMois(m, 1))}
              disabled={mois >= moisCourant()}
            >
              &rarr;
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exporterExcel('mois')}>
              Exporter le mois (Excel)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exporterExcel('tout')}>
              Tout l&apos;historique
            </button>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Heures ({libelleMois(mois)})</div>
            <div className="stat-value">{(summary?.totalGeneral?.heures || 0).toFixed(1)} h</div>
          </div>
          <div className="stat">
            <div className="stat-label">Montant total</div>
            <div className="stat-value accent">{formatEuros(summary?.totalGeneral?.montant)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Salaries actifs</div>
            <div className="stat-value">{summary?.parEmploye?.length || 0}</div>
          </div>
        </div>

        {onglet === 'vacations' && (
          <>
            <div className="card">
              <div className="card-title">Recap par salarie</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Salarie</th>
                      <th>Vacations</th>
                      <th>Heures</th>
                      <th>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.parEmploye || []).map((e) => (
                      <tr key={e.employeeId}>
                        <td>{e.prenom ? `${e.prenom} ${e.nom}` : e.nom}</td>
                        <td>{e.nbVacations}</td>
                        <td>{e.totalHeures.toFixed(2)} h</td>
                        <td>{formatEuros(e.totalMontant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="flex-between" style={{ marginBottom: 14 }}>
                <div className="card-title" style={{ margin: 0 }}>
                  Detail des vacations
                </div>
                <div className="row" style={{ maxWidth: 420, gap: 8 }}>
                  <select value={filtreEmploye} onChange={(e) => setFiltreEmploye(e.target.value)}>
                    <option value="">Tous les salaries</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                  <select value={filtreSite} onChange={(e) => setFiltreSite(e.target.value)}>
                    <option value="">Tous les sites</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {vacations.length === 0 ? (
                <div className="empty-state">Aucune vacation pour ces filtres.</div>
              ) : (
                <div className="list">
                  {vacations.map((v) => (
                    <div className="list-row" key={v.id}>
                      <div className="list-row-main">
                        <div className="list-row-title">
                          {v.prenom ? `${v.prenom} ${v.nom}` : v.nom} &middot;{' '}
                          {new Date(v.shift_date).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="list-row-sub">
                          {v.site} &middot; {v.poste} &middot; {v.heure_debut}&ndash;{v.heure_fin} &middot;{' '}
                          {Number(v.duree_heures).toFixed(2)} h
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="list-row-amount">{formatEuros(v.montant)}</div>
                        <span
                          className={`pill ${v.valide ? 'pill-success' : 'pill-warning'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleValide(v.id, !v.valide)}
                          title="Cliquer pour changer le statut"
                        >
                          {v.valide ? 'Validee' : 'En attente'}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => supprimerVacation(v.id)}>
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {onglet === 'employees' && (
          <div className="card">
            <div className="card-title">Ajouter un salarie</div>
            <form onSubmit={ajouterEmploye}>
              <div className="row">
                <div className="field">
                  <label>Nom</label>
                  <input type="text" value={nouvNom} onChange={(e) => setNouvNom(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Prenom</label>
                  <input type="text" value={nouvPrenom} onChange={(e) => setNouvPrenom(e.target.value)} />
                </div>
                <div className="field">
                  <label>Code (4 car. min.)</label>
                  <input type="text" value={nouvCode} onChange={(e) => setNouvCode(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Taux horaire perso (optionnel)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Taux du poste par defaut"
                    value={nouvTauxPerso}
                    onChange={(e) => setNouvTauxPerso(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={ajoutEnCours}>
                Ajouter
              </button>
            </form>

            <div style={{ marginTop: 22 }}>
              <div className="list">
                {employees.map((e) => (
                  <div className="list-row" key={e.id}>
                    <div className="list-row-main">
                      <div className="list-row-title">{e.prenom ? `${e.prenom} ${e.nom}` : e.nom}</div>
                      <div className="list-row-sub">
                        {e.actif ? 'Actif' : 'Inactif'}
                        {e.taux_horaire != null && (
                          <span className="pill pill-success" style={{ marginLeft: 8 }}>
                            {formatEuros(e.taux_horaire)}/h perso
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Taux perso"
                        style={{ width: 110 }}
                        value={tauxEdit[e.id] ?? (e.taux_horaire != null ? String(e.taux_horaire) : '')}
                        onChange={(ev) => setTauxEdit((c) => ({ ...c, [e.id]: ev.target.value }))}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={() => enregistrerTauxPerso(e.id)}>
                        Appliquer le taux
                      </button>
                      <input
                        type="text"
                        placeholder="Nouveau code"
                        style={{ width: 130 }}
                        value={codeReset[e.id] || ''}
                        onChange={(ev) => setCodeReset((c) => ({ ...c, [e.id]: ev.target.value }))}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={() => reinitialiserCode(e.id)}>
                        Reinitialiser
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleEmployeActif(e.id, !e.actif)}
                      >
                        {e.actif ? 'Desactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {onglet === 'rapport' && (
          <div className="card">
            <div className="card-title">Rapport par salarie &mdash; heures par mois et par site</div>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Salarie</label>
              <select value={rapportEmploye} onChange={(e) => setRapportEmploye(e.target.value)}>
                <option value="">Choisir un salarie</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.prenom ? `${e.prenom} ${e.nom}` : e.nom}
                  </option>
                ))}
              </select>
            </div>

            {!rapportEmploye && <div className="empty-state">Selectionnez un salarie pour voir son historique.</div>}

            {rapportEmploye && rapportChargement && (
              <div className="center-loading">
                <div className="spinner" />
              </div>
            )}

            {rapportEmploye && !rapportChargement && rapportData && rapportData.rows.length === 0 && (
              <div className="empty-state">Aucune vacation enregistree pour ce salarie.</div>
            )}

            {rapportEmploye && !rapportChargement && rapportData && rapportData.rows.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mois</th>
                      {rapportData.sites.map((s) => (
                        <th key={s.id}>{s.nom}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapportData.rows.map((row) => (
                      <tr key={row.mois}>
                        <td style={{ fontWeight: 600 }}>{libelleMois(row.mois)}</td>
                        {rapportData.sites.map((s) => {
                          const cellule = row.parSite[s.id];
                          return (
                            <td key={s.id}>
                              {cellule ? (
                                <>
                                  {cellule.heures.toFixed(2)} h
                                  <div className="small muted">{formatEuros(cellule.montant)}</div>
                                </>
                              ) : (
                                <span className="muted">&ndash;</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ fontWeight: 600 }}>
                          {row.totalHeures.toFixed(2)} h
                          <div className="small muted">{formatEuros(row.totalMontant)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      {rapportData.sites.map((s) => (
                        <th key={s.id}>
                          {(rapportData.totalsBySite[s.id]?.heures || 0).toFixed(2)} h
                          <div className="small" style={{ textTransform: 'none', fontWeight: 400 }}>
                            {formatEuros(rapportData.totalsBySite[s.id]?.montant)}
                          </div>
                        </th>
                      ))}
                      <th>
                        {rapportData.grandTotal.heures.toFixed(2)} h
                        <div className="small" style={{ textTransform: 'none', fontWeight: 400 }}>
                          {formatEuros(rapportData.grandTotal.montant)}
                        </div>
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {onglet === 'sites' && (
          <div className="card">
            <div className="card-title">Ajouter un site</div>
            <form onSubmit={ajouterSite} className="row">
              <div className="field">
                <label>Nom du site</label>
                <input type="text" value={nouvSite} onChange={(e) => setNouvSite(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" type="submit">
                  Ajouter
                </button>
              </div>
            </form>

            <div style={{ marginTop: 22 }} className="list">
              {sites.map((s) => (
                <div className="list-row" key={s.id}>
                  <div className="list-row-main">
                    <div className="list-row-title">{s.nom}</div>
                    <div className="list-row-sub">{s.actif ? 'Actif' : 'Inactif'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleSiteActif(s.id, !s.actif)}>
                      {s.actif ? 'Desactiver' : 'Activer'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => supprimerSite(s.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {onglet === 'postes' && (
          <div className="card">
            <div className="card-title">Ajouter un poste</div>
            <form onSubmit={ajouterPoste} className="row">
              <div className="field">
                <label>Nom du poste</label>
                <input type="text" value={nouvPoste} onChange={(e) => setNouvPoste(e.target.value)} required />
              </div>
              <div className="field">
                <label>Taux horaire (EUR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={nouvTaux}
                  onChange={(e) => setNouvTaux(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" type="submit">
                  Ajouter
                </button>
              </div>
            </form>

            <div style={{ marginTop: 22 }} className="list">
              {postes.map((p) => (
                <div className="list-row" key={p.id}>
                  <div className="list-row-main">
                    <div className="list-row-title">{p.nom}</div>
                    <div className="list-row-sub">
                      {formatEuros(p.taux_horaire)}/h &middot; {p.actif ? 'Actif' : 'Inactif'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => togglePosteActif(p.id, !p.actif)}
                    >
                      {p.actif ? 'Desactiver' : 'Activer'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => supprimerPoste(p.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
