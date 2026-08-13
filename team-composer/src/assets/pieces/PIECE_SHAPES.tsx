import type { ReactElement } from 'react';

/**
 * Geometric silhouette for each piece sigla in pieces.json. Classic pieces (RE, RA, TO, AL, CA, PE)
 * echo traditional chess-piece silhouettes in a stylized form; custom pieces use distinct
 * primitive shapes so they read apart from each other and from the classics on the board
 * (e.g. the Duca's crown, the Generale's star, the Tigre's striped face, the Rinoceronte's horn,
 * the Coniglio's ears, the Rimbalzatore's bounce, the Swapper's crossed arrows, the Stunner's
 * snowflake, the Damone's crowned checkers disc).
 * Every shape draws in a 0..100 viewBox and uses `currentColor`, so team color is set by the
 * caller via CSS `color`.
 */
export const PIECE_SHAPES: Record<string, ReactElement> = {
  // --- Classic pieces ---------------------------------------------------
  RE: (
    <g>
      <rect x="30" y="62" width="40" height="18" rx="3" />
      <path d="M28 62 Q50 40 72 62 Z" />
      <rect x="46" y="14" width="8" height="20" />
      <rect x="38" y="20" width="24" height="8" />
      <circle cx="50" cy="10" r="6" />
    </g>
  ),
  RA: (
    <g>
      <rect x="28" y="64" width="44" height="16" rx="3" />
      <path d="M26 64 Q50 42 74 64 Z" />
      <circle cx="26" cy="30" r="7" />
      <circle cx="50" cy="18" r="7" />
      <circle cx="74" cy="30" r="7" />
      <path d="M26 30 L34 62 L66 62 L74 30" fill="none" stroke="currentColor" strokeWidth="5" />
    </g>
  ),
  TO: (
    <g>
      <rect x="26" y="60" width="48" height="20" rx="2" />
      <rect x="30" y="30" width="40" height="30" />
      <rect x="26" y="14" width="10" height="16" />
      <rect x="45" y="14" width="10" height="16" />
      <rect x="64" y="14" width="10" height="16" />
    </g>
  ),
  AL: (
    <g>
      <rect x="30" y="66" width="40" height="14" rx="3" />
      <path d="M32 66 Q30 40 50 26 Q70 40 68 66 Z" />
      <circle cx="50" cy="16" r="7" />
    </g>
  ),
  CA: (
    <g>
      <path d="M32 80 L32 58 Q26 40 40 26 Q46 16 60 18 Q56 24 60 28 Q72 30 74 44 L66 44 Q64 38 58 38 Q64 50 62 58 L68 80 Z" />
    </g>
  ),
  PE: (
    <g>
      <rect x="34" y="66" width="32" height="14" rx="3" />
      <path d="M36 66 Q34 50 44 44 Q38 40 38 32 A12 12 0 1 1 62 32 Q62 40 56 44 Q66 50 64 66 Z" />
    </g>
  ),
  // --- Custom pieces ------------------------------------------------------
  PG: (
    <g>
      <rect x="36" y="60" width="28" height="16" rx="3" />
      <polygon points="50,20 68,60 32,60" />
    </g>
  ),
  FG: (
    <g>
      <rect x="34" y="62" width="32" height="14" rx="3" />
      <rect x="32" y="26" width="36" height="36" rx="4" />
    </g>
  ),
  CR: (
    <g>
      <rect x="34" y="64" width="32" height="12" rx="3" />
      <polygon points="50,16 78,50 50,80 22,50" />
    </g>
  ),
  RI: (
    <g>
      <rect x="34" y="64" width="32" height="12" rx="3" />
      <polygon points="50,12 82,50 50,84 18,50" />
      <circle cx="50" cy="50" r="8" />
    </g>
  ),
  CM: (
    <g>
      <rect x="34" y="64" width="32" height="12" rx="3" />
      <polygon points="50,14 78,30 78,62 50,78 22,62 22,30" />
    </g>
  ),
  BE: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <polygon points="50,10 58,34 82,26 62,44 78,64 54,56 50,80 46,56 22,64 38,44 18,26 42,34" />
    </g>
  ),
  NE: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <path d="M62 16 A28 28 0 1 0 62 74 A22 22 0 1 1 62 16 Z" />
    </g>
  ),
  IQ: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <circle cx="50" cy="40" r="26" fill="none" stroke="currentColor" strokeWidth="7" />
      <rect x="46" y="16" width="8" height="48" />
      <rect x="26" y="36" width="48" height="8" />
    </g>
  ),
  GL: (
    <g>
      <rect x="26" y="64" width="48" height="14" rx="2" />
      <rect x="24" y="20" width="52" height="46" rx="6" />
    </g>
  ),
  MI: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <circle cx="50" cy="42" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="50" cy="42" r="12" />
    </g>
  ),
  AR: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <polygon points="50,14 60,44 50,38 40,44" />
      <rect x="46" y="38" width="8" height="30" />
      <polygon points="50,68 58,58 42,58" />
    </g>
  ),
  PA: (
    <g>
      <path d="M50 12 L78 22 Q78 56 50 82 Q22 56 22 22 Z" />
    </g>
  ),
  CO: (
    <g>
      <rect x="28" y="66" width="44" height="12" rx="2" />
      <polygon points="50,12 76,28 76,58 50,74 24,58 24,28" />
    </g>
  ),
  DA: (
    <g>
      <circle cx="50" cy="50" r="30" />
      <circle cx="50" cy="50" r="17" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.45" />
    </g>
  ),
  CV: (
    <g>
      <polygon points="50,14 66,38 50,32 34,38" />
      <polygon points="50,32 70,54 50,48 30,54" />
      <polygon points="50,48 74,80 50,68 26,80" />
    </g>
  ),
  OR: (
    <g>
      <polygon points="50,14 62,26 62,42 74,50 62,58 62,74 50,86 38,74 38,58 26,50 38,42 38,26" />
    </g>
  ),
  SP: (
    <g>
      <path d="M50 14 A26 26 0 0 1 76 40 L76 74 L64 62 L52 74 L40 62 L28 74 L24 74 L24 40 A26 26 0 0 1 50 14 Z" />
      <circle cx="42" cy="38" r="4" fillOpacity="0.4" />
      <circle cx="58" cy="38" r="4" fillOpacity="0.4" />
    </g>
  ),
  CT: (
    <g>
      <rect x="24" y="60" width="52" height="14" rx="2" />
      <rect x="30" y="46" width="8" height="22" />
      <rect x="62" y="46" width="8" height="22" />
      <path d="M30 46 Q50 10 70 46 Z" />
      <circle cx="50" cy="16" r="8" />
    </g>
  ),
  MG: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <polygon points="50,12 74,50 50,86 26,50" />
      <polygon points="50,32 61,50 50,68 39,50" fillOpacity="0.35" />
    </g>
  ),
  GR: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <polygon points="50,12 58,26 72,20 62,38 78,44 62,50 66,64 50,56 34,64 38,50 22,44 38,38 28,20 42,26" />
    </g>
  ),
  MA: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <circle cx="50" cy="44" r="20" />
      <polygon points="50,12 56,26 68,16 62,30 78,26 64,38 76,48 60,46 62,62 52,52 48,62 38,52 40,62 24,48 36,38 22,26 38,30 32,16 44,26" />
    </g>
  ),
  DR: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <path d="M36 58 Q30 42 40 34 Q50 26 60 34 Q70 42 64 58 Z" />
      <polygon points="60,34 84,18 68,46" />
      <path d="M40 48 Q28 56 22 72 Q34 62 44 58 Z" />
    </g>
  ),
  RP: (
    <g>
      <rect x="34" y="66" width="32" height="12" rx="3" />
      <polygon points="50,10 74,34 58,34 58,56 42,56 42,34 26,34" />
      <rect x="46" y="56" width="8" height="10" />
    </g>
  ),
  DM: (
    <g>
      <circle cx="50" cy="62" r="28" />
      <circle cx="50" cy="62" r="16" fillOpacity="0.35" />
      <path d="M36 40 L36 27 L44 33 L50 21 L56 33 L64 27 L64 40 Z" />
    </g>
  ),
  DU: (
    <g>
      <path d="M30 74 L30 54 L42 60 L50 46 L58 60 L70 54 L70 74 Z" />
      <rect x="30" y="74" width="40" height="12" rx="2" />
    </g>
  ),
  GE: (
    <g>
      <polygon points="50,10 59,38 86,38 64,55 72,81 50,65 28,81 36,55 14,38 41,38" />
    </g>
  ),
  TI: (
    <g>
      <rect x="28" y="66" width="44" height="12" rx="3" />
      <circle cx="50" cy="48" r="22" />
      <polygon points="34,32 28,14 46,26" />
      <polygon points="66,32 72,14 54,26" />
      <rect x="40" y="34" width="5" height="14" rx="2" fillOpacity="0.4" />
      <rect x="48" y="30" width="5" height="14" rx="2" fillOpacity="0.4" />
      <rect x="56" y="34" width="5" height="14" rx="2" fillOpacity="0.4" />
    </g>
  ),
  RN: (
    <g>
      <rect x="24" y="58" width="52" height="18" rx="9" />
      <polygon points="28,58 22,38 38,52" />
      <circle cx="36" cy="64" r="3.5" fillOpacity="0.35" />
    </g>
  ),
  CN: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <path d="M40 40 Q34 18 28 12 Q38 22 40 32 Z" />
      <path d="M60 40 Q66 18 72 12 Q62 22 60 32 Z" />
      <circle cx="50" cy="52" r="16" />
    </g>
  ),
  RB: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <path d="M22 70 L46 38" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M52 28 L74 66" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      <polygon points="74,66 58,64 66,50" />
    </g>
  ),
  SW: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <polygon points="20,36 54,36 54,28 72,44 54,60 54,52 20,52" />
      <polygon points="80,60 46,60 46,68 28,52 46,36 46,44 80,44" />
    </g>
  ),
  ST: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 50 50)`}>
          <rect x="47" y="12" width="6" height="40" rx="2" />
          <rect x="43" y="22" width="14" height="4" rx="1" />
          <rect x="41" y="34" width="18" height="4" rx="1" />
        </g>
      ))}
    </g>
  ),
  TT: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <path d="M36 66 Q36 22 50 22 Q64 22 64 66 Z" />
      <circle cx="50" cy="44" r="11" />
      <path d="M50 33 Q58 40 50 47 Q42 54 50 61" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  BO: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <circle cx="50" cy="48" r="19" />
      <path d="M48 30 L44 12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 30 Q58 34 55 42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M46 47 h8 M50 43 v8" stroke="var(--piece-label-color, #fff)" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  VZ: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <path d="M50 60 Q38 54 40 44 Q42 36 52 38 Q58 40 56 47 Q54 51 49 50" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 42 Q56 40 55 34 Q54 28 48 30 Q44 32 46 37" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="49" cy="45" r="4" />
    </g>
  ),
  BS: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <path d="M20 66 Q30 30 50 26 Q70 30 80 66 Q66 58 62 66 L38 66 Q34 58 20 66 Z" />
      <circle cx="38" cy="44" r="5" fill="var(--piece-label-color, #fff)" />
      <circle cx="62" cy="44" r="5" fill="var(--piece-label-color, #fff)" />
      <circle cx="39" cy="43" r="2" />
      <circle cx="61" cy="43" r="2" />
      <path d="M44 52 Q50 55 56 52" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 14 L42 22 M62 14 L58 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  BR: (
    <g>
      <rect x="30" y="66" width="40" height="12" rx="3" />
      <path d="M24 62 Q34 40 50 36 Q66 40 76 62 Q64 54 58 60 Q54 56 50 60 Q46 56 42 60 Q36 54 24 62 Z" />
      <path d="M42 24 L50 34 L58 24 L54 40 L46 40 Z" />
    </g>
  ),
  LP: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <polygon points="58,12 42,46 50,46 40,74 62,38 52,38" />
    </g>
  ),
  VL: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <path d="M50 16 A26 26 0 1 0 50 62 A19 19 0 1 1 50 16 Z" />
      <path d="M43 34 L46 46 L49 34 L52 46 L55 34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </g>
  ),
  GH: (
    <g>
      <rect x="24" y="72" width="52" height="10" rx="2" />
      <path d="M36 72 Q30 50 38 44 Q32 40 34 30 Q38 20 50 20 Q62 20 66 30 Q68 40 62 44 Q70 50 64 72 Z" />
      <circle cx="42" cy="34" r="3.5" fill="var(--piece-label-color, #fff)" />
      <circle cx="58" cy="34" r="3.5" fill="var(--piece-label-color, #fff)" />
      <circle cx="42.5" cy="34" r="1.5" />
      <circle cx="57.5" cy="34" r="1.5" />
    </g>
  ),
  SC: (
    <g>
      <rect x="26" y="72" width="48" height="10" rx="2" />
      <path d="M30 72 Q30 54 44 50 Q54 47 60 40 Q64 34 74 24 Q78 36 68 46 Q78 50 76 60 L76 72 Z" />
      <polygon points="58,38 62,26 68,36" />
      <circle cx="60" cy="33" r="1.6" fill="var(--piece-label-color, #fff)" />
    </g>
  ),
  PT: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <ellipse cx="35" cy="50" rx="12" ry="16" fill="none" stroke="currentColor" strokeWidth="5" />
      <ellipse cx="65" cy="50" rx="12" ry="16" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M47 50 L53 50" stroke="currentColor" strokeWidth="4" />
    </g>
  ),
  SM: (
    <g>
      <rect x="30" y="68" width="40" height="12" rx="3" />
      <polygon points="50,10 70,30 60,55 40,55 30,30" />
      <polygon points="50,20 65,35 58,50 42,50 35,35" fillOpacity="0.3" />
      <path d="M50 10 L50 20 M70 30 L65 35 M60 55 L58 50 M40 55 L42 50 M30 30 L35 35" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
};
