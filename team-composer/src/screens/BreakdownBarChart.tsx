import type { PuntiEstimate } from '../data/estimatePunti';

/**
 * First 3 slots of the app's validated dark-mode categorical triad (blue/orange/aqua) — chosen so
 * mobility/compound/mechanic never borrow the app's existing status hues (green/amber/red already
 * mean close/over/under elsewhere, see `PuntiScatterChart`), avoiding an accidental "good/bad"
 * reading on what is purely a decomposition of one number into its parts.
 */
const BREAKDOWN_COLORS = {
  mobility: '#3987e5',
  compound: '#d95926',
  mechanic: '#199e70',
} as const;

interface BreakdownBar {
  key: string;
  label: string;
  value: number;
  color: string;
  lowConfidence: boolean;
}

/**
 * Horizontal diverging bar chart decomposing one piece's `PuntiEstimate` into its three additive
 * contributions (mobility, compound/multi-entry, special-mechanic bonus) — replaces the dense,
 * hard-to-scan text breakdown previously packed into a single table cell. Reused by both the main
 * table's per-piece detail panel and the piece designer (`PieceDesignerPanel`), so both surfaces
 * read a piece's estimate the same way.
 */
function BreakdownBarChart({ estimate }: { estimate: PuntiEstimate }) {
  const { breakdown } = estimate;
  const bars: BreakdownBar[] = [
    { key: 'mobility', label: 'Mobilità', value: breakdown.mobilityContribution, color: BREAKDOWN_COLORS.mobility, lowConfidence: false },
    { key: 'compound', label: 'Composto', value: breakdown.compoundContribution, color: BREAKDOWN_COLORS.compound, lowConfidence: false },
    {
      key: 'mechanic',
      label: 'Meccanica speciale',
      value: breakdown.specialMechanicBonus,
      color: BREAKDOWN_COLORS.mechanic,
      lowConfidence: breakdown.mechanicConfidence !== 'high',
    },
  ];

  const width = 340;
  const rowHeight = 30;
  const height = bars.length * rowHeight + 6;
  const labelWidth = 132;
  const valueGutter = 56;
  const plotWidth = width - labelWidth - valueGutter;
  const halfWidth = plotWidth / 2;
  const zeroX = labelWidth + halfWidth;
  const maxAbs = Math.max(1, ...bars.map((b) => Math.abs(b.value)));

  return (
    <div className="max-w-[420px]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Scomposizione della stima: mobilità ${breakdown.mobilityContribution.toFixed(1)}, composto ${breakdown.compoundContribution.toFixed(1)}, meccanica ${breakdown.specialMechanicBonus.toFixed(1)}`}
        className="h-auto w-full"
      >
        <line x1={zeroX} y1={0} x2={zeroX} y2={height} className="stroke-slate-700 stroke-1" />
        {bars.map((bar, i) => {
          const barLen = (Math.abs(bar.value) / maxAbs) * halfWidth;
          const y = i * rowHeight + 3;
          const barHeight = rowHeight - 10;
          const barX = bar.value >= 0 ? zeroX : zeroX - barLen;
          const valueX = bar.value >= 0 ? zeroX + barLen + 6 : zeroX - barLen - 6;
          return (
            <g key={bar.key}>
              <text x={labelWidth - 8} y={y + barHeight / 2 + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                {bar.label}
              </text>
              <rect
                x={barX}
                y={y}
                width={Math.max(barLen, 1)}
                height={barHeight}
                rx={4}
                fill={bar.color}
                opacity={bar.lowConfidence ? 0.45 : 0.95}
              />
              <text
                x={valueX}
                y={y + barHeight / 2 + 4}
                textAnchor={bar.value >= 0 ? 'start' : 'end'}
                className="fill-slate-300 text-[10px] font-semibold"
              >
                {bar.value > 0 ? '+' : ''}
                {bar.value.toFixed(1)}
                {bar.lowConfidence ? ' ⚠' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[0.78rem] text-slate-400">
        Totale stimato: <strong className="text-slate-100">{estimate.suggestedPunti}</strong> pt · intervallo plausibile{' '}
        <strong className="text-slate-100">{estimate.confidenceInterval.low}–{estimate.confidenceInterval.high}</strong>
      </p>
    </div>
  );
}

export default BreakdownBarChart;
