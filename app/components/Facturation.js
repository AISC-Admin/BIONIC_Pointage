'use client';

import { useEffect, useState, useCallback } from 'react';

// Onglet "Facturation" : listing mensuel a facturer, par site (un client
// peut avoir plusieurs sites, chacun facture separement). Seules les
// vacations VALIDEES par le manager sont prises en compte. Pour chaque site :
// Poste, nombre d'heures, tarif horaire HT (grille de l'onglet Clients) et montant.

function formatEuros(v) {
  if (v === null || v === undefined) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

function formatHeures(h) {
  return `${Number(h || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

export default function Facturation({ mois, libelleMois }) {
  const [data, setData] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    const res = await fetch(`/api/admin/facturation?mois=${mois}`);
    if (res.ok) {
      setData(await res.json());
      setErreur(null);
    } else {
      setErreur('Impossible de charger la facturation.');
    }
    setChargement(false);
  }, [mois]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Saisie rapide d'un tarif manquant directement depuis le listing.
  async function saisirTarif(site, ligne, valeur) {
    if (String(valeur).trim() === '') return;
    const res = await fetch('/api/admin/clients/tarifs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: site.site_id, poste_id: ligne.poste_id, taux: valeur })
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErreur(d.erreur || 'Tarif non enregistre.');
      return;
    }
    charger();
  }

  const libelle = libelleMois ? libelleMois(mois) : mois;

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="card-title" style={{ margin: 0 }}>
          Facturation clients · {libelle}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => (window.location.href = `/api/admin/facturation/export?mois=${mois}`)}>
          Exporter pour la compta (Excel)
        </button>
      </div>

      {erreur && <div className="alert alert-error">{erreur}</div>}

      {chargement && !data ? (
        <div className="muted small">Chargement...</div>
      ) : !data ? null : (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="stat-label">Heures validees a facturer</div>
              <div className="stat-value">{formatHeures(data.total.heures)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Montant HT a facturer</div>
              <div className="stat-value accent">{formatEuros(data.total.montant)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sites factures</div>
              <div className="stat-value">{data.sites.length}</div>
            </div>
          </div>

          {data.enAttente?.nb > 0 && (
            <div className="alert alert-error" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'transparent' }}>
              {data.enAttente.nb} vacation(s) ({formatHeures(data.enAttente.heures)}) de ce mois ne sont pas encore validees : elles
              ne sont pas comptees ici tant que le manager ne les a pas validees.
            </div>
          )}
          {data.total.tarifsManquants > 0 && (
            <div className="alert alert-error">
              {data.total.tarifsManquants} ligne(s) sans tarif de facturation : le montant total est incomplet. Saisissez le tarif
              ci-dessous ou dans l&apos;onglet Clients.
            </div>
          )}
          {data.total.sitesSansClient > 0 && (
            <div className="alert alert-error">
              {data.total.sitesSansClient} site(s) avec des heures ne sont rattaches a aucun client (onglet Clients).
            </div>
          )}

          {data.sites.length === 0 ? (
            <div className="empty-state">Aucune vacation validee pour ce mois.</div>
          ) : (
            data.sites.map((s) => (
              <div key={s.site_id} style={{ marginBottom: 18 }}>
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{s.site}</span>
                    <span className="muted"> · {s.client || 'Site sans client'}</span>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatEuros(s.montant)} HT</div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Poste</th>
                        <th style={{ textAlign: 'right' }}>Vacations</th>
                        <th style={{ textAlign: 'right' }}>Heures</th>
                        <th style={{ textAlign: 'right' }}>Tarif HT</th>
                        <th style={{ textAlign: 'right' }}>Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lignes.map((l) => (
                        <tr key={l.poste_id}>
                          <td style={{ fontWeight: 600 }}>{l.poste}</td>
                          <td style={{ textAlign: 'right' }}>{l.nb_vacations}</td>
                          <td style={{ textAlign: 'right' }}>{formatHeures(l.heures)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {l.tarif !== null ? (
                              `${formatEuros(l.tarif)}/h`
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Tarif €/h"
                                style={{ width: 100, padding: '5px 8px', textAlign: 'right', borderColor: 'var(--danger)' }}
                                onBlur={(e) => saisirTarif(s, l, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                              />
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {l.montant !== null ? formatEuros(l.montant) : <span className="pill pill-danger">Tarif manquant</span>}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <td style={{ fontWeight: 700 }}>Total site</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatHeures(s.heures)}</td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatEuros(s.montant)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
