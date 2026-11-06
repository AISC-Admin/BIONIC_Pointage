// Normalisation d'un devis recu du formulaire.
export const STATUTS_DEVIS = ['en_cours', 'valide', 'refuse'];

export function nettoyerDevis(data) {
  const txt = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };
  const num = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const lignes = (Array.isArray(data.lignes) ? data.lignes : [])
    .map((l) => ({
      designation: txt(l.designation) || '',
      quantite: num(l.quantite),
      prix_unitaire: num(l.prix_unitaire)
    }))
    .filter((l) => l.designation || l.quantite || l.prix_unitaire);
  const montant_ht = Math.round(lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire, 0) * 100) / 100;
  const tva = data.tva_taux === '' || data.tva_taux == null ? 20 : num(data.tva_taux);
  const statut = STATUTS_DEVIS.includes(data.statut) ? data.statut : 'en_cours';
  const mois = /^\d{4}-\d{2}$/.test(data.mois_facturation || '') ? data.mois_facturation : null;
  return {
    numero: txt(data.numero),
    client_id: data.client_id ? Number(data.client_id) : null,
    site_id: data.site_id ? Number(data.site_id) : null,
    societe_id: data.societe_id ? Number(data.societe_id) : null,
    objet: txt(data.objet),
    date_emission: txt(data.date_emission),
    date_validite: txt(data.date_validite),
    lignes,
    montant_ht,
    tva_taux: tva,
    statut,
    mois_facturation: mois,
    pdf_url: txt(data.pdf_url),
    pdf_nom: txt(data.pdf_nom),
    notes: txt(data.notes)
  };
}

export function urlPdfValide(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.blob.vercel-storage.com') && u.pathname.startsWith('/clients/');
  } catch {
    return false;
  }
}
