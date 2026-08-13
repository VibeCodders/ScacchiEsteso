import type { SVGProps } from 'react';
import { PIECE_SHAPES } from './PIECE_SHAPES';

export interface PieceIconProps extends SVGProps<SVGSVGElement> {
  sigla: string;
}

/** Renders the silhouette for a piece sigla, or a plain labeled circle as a fallback for unknown siglas. */
function PieceIcon({ sigla, ...svgProps }: PieceIconProps) {
  const shape = PIECE_SHAPES[sigla];

  if (!shape) {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-label={sigla} {...svgProps}>
        <circle cx="50" cy="50" r="36" fill="currentColor" />
        <text x="50" y="58" fontSize="28" textAnchor="middle" fill="var(--piece-label-color, #fff)">
          {sigla}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={sigla} fill="currentColor" {...svgProps}>
      {shape}
    </svg>
  );
}

export default PieceIcon;
