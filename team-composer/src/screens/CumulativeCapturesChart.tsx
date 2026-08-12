import type { Owner } from '../game/board';

// Blue/orange — the app's validated dark-mode categorical triad (same hues as MaterialTrendChart).
const COLOR_A = '#3987e5';
const COLOR_B = '#d95926';

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { left: 36, right: 12, top: 14, bottom: 26 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

interface Props {
  points: { ply: number; A: number; B: number }[];
  ownerLabel: (owner: Owner) => string;
}

/** Two-line SVG chart of each player's cumulative real captures across the plies of the finished
 *  game — the "tempo" counterpart of the material trend: a flat line means a quiet phase, a step
 *  means a capture landed. Mirrors MaterialTrendChart's geometry so the two charts read alike. */
function CumulativeCapturesChart({ points, ownerLabel }: Props) {
  const all = points.flatMap((p) => [p.A, p.B]);
  const max = Math.max(...all, 1);
  const span = Math.max(max, 1);

  const x = (ply: number) =>
    PAD.left + (points.length <= 1 ? 0 : (ply / (points.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + (1 - v / span) * PLOT_H;

  const lineA = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ply).toFixed(1)},${y(p.A).toFixed(1)}`).join(' ');
  const lineB = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ply).toFixed(1)},${y(p.B).toFixed(1)}`).join(' ');
  const showDots = points.length <= 24;

  // Up to 5 integer y ticks.
  const yTickCount = Math.min(5, max + 1);
  const yTicks = Array.from({ length: yTickCount }, (_, i) => Math.round((max * i) / Math.max(yTickCount - 1, 1)));
  const xTickCount = Math.min(6, Math.max(2, points.length));
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (points.length - 1)) / Math.max(xTickCount - 1, 1)),
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Catture cumulative mossa per mossa"
        data-testid="cumulative-captures-chart"
      >
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <text x={PAD.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity={0.6}>
              {tick}
            </text>
          </g>
        ))}
        {xTicks.map((ply, i) => (
          <text key={i} x={x(ply)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.6}>
            {ply}
          </text>
        ))}
        <path d={lineA} fill="none" stroke={COLOR_A} strokeWidth="2.5" data-testid="captures-line-a" />
        <path d={lineB} fill="none" stroke={COLOR_B} strokeWidth="2.5" data-testid="captures-line-b" />
        {showDots &&
          points.map((p, i) => (
            <g key={i}>
              <circle cx={x(p.ply)} cy={y(p.A)} r="2.5" fill={COLOR_A} />
              <circle cx={x(p.ply)} cy={y(p.B)} r="2.5" fill={COLOR_B} />
            </g>
          ))}
      </svg>

      <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-slate-700 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_A }} />
          {ownerLabel('A')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_B }} />
          {ownerLabel('B')}
        </span>
      </div>
    </div>
  );
}

export default CumulativeCapturesChart;
