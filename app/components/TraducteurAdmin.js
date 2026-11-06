'use client';

import { useEffect, useState } from 'react';
import { LANGUES_ADMIN, traduireAdmin } from '@/lib/i18nAdmin';

// Langue de l'espace responsable (FR / EN / ES), memorisee par navigateur.
const CLE = 'bionic-admin-langue';
const ATTRIBUTS = ['placeholder', 'title', 'aria-label', 'alt'];

export function useLangueAdmin() {
  const [langue, setLangue] = useState('fr');
  useEffect(() => {
    try {
      const l = window.localStorage.getItem(CLE);
      if (l && LANGUES_ADMIN.some((x) => x.code === l)) setLangue(l);
    } catch (e) {
      // localStorage indisponible : francais par defaut.
    }
  }, []);
  function changer(l) {
    setLangue(l);
    try {
      window.localStorage.setItem(CLE, l);
    } catch (e) {
      // ignore
    }
  }
  return [langue, changer];
}

export function SelecteurLangueAdmin({ langue, onChange, sombre }) {
  return (
    <div className={`lang-switch${sombre ? ' lang-switch-sombre' : ''}`} data-no-translate="">
      {LANGUES_ADMIN.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-switch-btn${langue === l.code ? ' active' : ''}`}
          onClick={() => onChange(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// Traduit a l'affichage tous les textes francais de la page (textes,
// libelles de champs, infobulles) ainsi que les fenetres de confirmation.
// Le texte d'origine est memorise pour chaque noeud : quand React met a jour
// un texte, la nouvelle valeur francaise est retraduite ; quand on revient
// en francais, le texte d'origine est remis. Les donnees saisies (valeurs
// des champs) ne sont jamais modifiees.
export default function TraducteurAdmin({ langue }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const racine = document.body;
    const origTexte = new WeakMap(); // noeud texte -> texte francais
    const poseTexte = new WeakMap(); // noeud texte -> dernier texte pose
    const origAttr = new WeakMap(); // element -> { attribut: texte francais }

    function exclu(el) {
      return !!(el && el.closest && el.closest('script, style, textarea, [data-no-translate]'));
    }

    function traiterTexte(n) {
      if (exclu(n.parentElement)) return;
      const actuel = n.nodeValue;
      if (poseTexte.get(n) !== actuel) origTexte.set(n, actuel); // React a change le texte
      const orig = origTexte.get(n) ?? actuel;
      const voulu = traduireAdmin(orig, langue);
      if (voulu !== actuel) n.nodeValue = voulu;
      poseTexte.set(n, voulu);
    }

    function traiterAttributs(el) {
      if (exclu(el)) return;
      let memo = origAttr.get(el);
      for (const a of ATTRIBUTS) {
        if (!el.hasAttribute(a)) continue;
        const actuel = el.getAttribute(a);
        if (!memo) {
          memo = {};
          origAttr.set(el, memo);
        }
        const pose = memo[`__${a}`];
        if (pose !== actuel) memo[a] = actuel;
        const voulu = traduireAdmin(memo[a], langue);
        if (voulu !== actuel) el.setAttribute(a, voulu);
        memo[`__${a}`] = voulu;
      }
    }

    function parcourir(noeud) {
      if (noeud.nodeType === 3) {
        traiterTexte(noeud);
        return;
      }
      if (noeud.nodeType !== 1) return;
      traiterAttributs(noeud);
      const marcheur = document.createTreeWalker(noeud, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n = marcheur.nextNode();
      while (n) {
        if (n.nodeType === 3) traiterTexte(n);
        else traiterAttributs(n);
        n = marcheur.nextNode();
      }
    }

    parcourir(racine);
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') traiterTexte(m.target);
        else if (m.type === 'attributes') traiterAttributs(m.target);
        else m.addedNodes.forEach(parcourir);
      }
    });
    obs.observe(racine, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });

    // Fenetres de confirmation / saisie du navigateur.
    const confirmOrig = window.confirm;
    const promptOrig = window.prompt;
    const alertOrig = window.alert;
    window.confirm = (msg) => confirmOrig.call(window, traduireAdmin(String(msg ?? ''), langue));
    window.prompt = (msg, def) => promptOrig.call(window, traduireAdmin(String(msg ?? ''), langue), def);
    window.alert = (msg) => alertOrig.call(window, traduireAdmin(String(msg ?? ''), langue));
    document.documentElement.lang = langue;

    return () => {
      obs.disconnect();
      window.confirm = confirmOrig;
      window.prompt = promptOrig;
      window.alert = alertOrig;
    };
  }, [langue]);

  return null;
}
