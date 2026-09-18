// Logo Bionic Stratom (repris tel quel du site officiel : deux arches en
// degrade navy -> bleu, evoquant un pont/une connexion, sur un ruban clair).
export function LogoMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bsBack" x1="8" y1="52" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a3a7a" />
          <stop offset="1" stopColor="#3b7bf2" />
        </linearGradient>
        <linearGradient id="bsFront" x1="40" y1="52" x2="92" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b7bf2" />
          <stop offset="1" stopColor="#8fdcf7" />
        </linearGradient>
        <linearGradient id="bsRibbon" x1="0" y1="45" x2="100" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef4ff" />
          <stop offset="1" stopColor="#9fc4f7" />
        </linearGradient>
      </defs>
      <path d="M4,50 L12,50 L10,60 L2,60 Z" fill="#16265a" opacity=".9" />
      <path d="M54,50 L64,50 L62,60 L52,60 Z" fill="#16265a" opacity=".9" />
      <path d="M88,44 L96,44 L94,56 L86,56 Z" fill="#1a3a7a" opacity=".9" />
      <g stroke="#c9cee0" strokeWidth="0.8" opacity=".4">
        <line x1="14" y1="42" x2="14" y2="52" />
        <line x1="20" y1="28" x2="20" y2="52" />
        <line x1="26" y1="16" x2="26" y2="52" />
        <line x1="40" y1="16" x2="40" y2="52" />
        <line x1="46" y1="28" x2="46" y2="52" />
        <line x1="52" y1="42" x2="52" y2="52" />
      </g>
      <path
        d="M8,52 C8,26 18,6 33,6 C48,6 58,26 58,52"
        fill="none"
        stroke="url(#bsBack)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g stroke="#dfe6f7" strokeWidth="0.8" opacity=".45">
        <line x1="48" y1="46" x2="48" y2="52" />
        <line x1="54" y1="34" x2="54" y2="52" />
        <line x1="60" y1="24" x2="60" y2="52" />
        <line x1="72" y1="24" x2="72" y2="52" />
        <line x1="78" y1="34" x2="78" y2="52" />
        <line x1="84" y1="46" x2="84" y2="52" />
      </g>
      <path
        d="M40,52 C40,32 50,16 66,16 C82,16 92,32 92,52"
        fill="none"
        stroke="url(#bsFront)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M0,50 C20,44 40,46 55,49 C70,52 85,50 96,45 L100,50 L92,54 C78,58 62,57 50,54 C35,50 18,49 0,54 Z"
        fill="url(#bsRibbon)"
        opacity=".92"
      />
    </svg>
  );
}

export function Brand({ subtitle }) {
  return (
    <span className="brand">
      <LogoMark className="brand-icon" />
      <span className="brand-text">
        <span className="brand-word">
          <b>BIONIC</b> <span>Stratom</span>
        </span>
        {subtitle && <span className="brand-sub">{subtitle}</span>}
      </span>
    </span>
  );
}
