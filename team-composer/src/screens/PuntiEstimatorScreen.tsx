import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pieces, sortByPunti } from '../data/pieces';
import { estimatePunti, estimatorFitQuality, type PuntiEstimate } from '../data/estimatePunti';
import type { Piece } from '../types';
import '../App.css';

/** How close is "close enough" before a suggestion counts as a meaningful over/under estimate. */
const CLOSE_ENOUGH_ABS_DIFF = 3;

type DiffStatus = 'close' | 'over' | 'under';

function diffStatus(actual: number, suggested: number): DiffStatus {
  const diff = suggested - actual;
  if (Math.abs(diff) <= CLOSE_ENOUGH_ABS_DIFF) return 'close';
  return diff > 0 ? 'over' : 'under';
}

function diffBadgeClass(actual: number, suggested: number): string {
  return `punti-diff-${diffStatus(actual, suggested)}`;
}

function formatDiff(actual: number, suggested: number): string {
  const diff = suggested - actual;
  if (diff === 0) return '0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

type SortKey = 'sigla' | 'actual' | 'diff';

interface Row {
  piece: Piece;
  estimate: PuntiEstimate;
}

function sortRows(rows: Row[], key: SortKey, dir: 'asc' | 'desc'): Row[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'sigla') return sign * a.piece.sigla.localeCompare(b.piece.sigla);
    if (key === 'actual') return sign * (a.piece.punti - b.piece.punti);
    const diffA = Math.abs(a.estimate.suggestedPunti - a.piece.punti);
    const diffB = Math.abs(b.estimate.suggestedPunti - b.piece.punti);
    return sign * (diffA - diffB);
  });
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className="punti-table-sortable" onClick={() => onSort(sortKey)}>
      {label}
      {isActive && <span className="sort-arrow">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

/**
 * Scatter chart plotting each piece's real punti (x) against its suggested punti (y), with a
 * dashed y=x reference line for "perfect estimate". Marker color follows the same close/over/under
 * status used by the table's diff badges (reuses the app's existing status palette rather than
 * introducing a new one); low-confidence pieces (mechanic bonus from a single roster example) are
 * additionally drawn as diamonds instead of circles, so that distinction never rests on color alone.
 */
function PuntiScatterChart({ rows }: { rows: Row[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const width = 480;
  const height = 320;
  const margin = { top: 16, right: 16, bottom: 36, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(1, ...rows.map((r) => Math.max(r.piece.punti, r.estimate.suggestedPunti))) * 1.08;

  const x = (v: number) => margin.left + (v / maxValue) * plotWidth;
  const y = (v: number) => margin.top + plotHeight - (v / maxValue) * plotHeight;

  const ticks = 5;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxValue * i) / ticks));

  const statusColor: Record<DiffStatus, string> = {
    close: '#4ade80',
    over: '#f87171',
    under: '#fbbf24',
  };

  return (
    <div className="scatter-chart-wrapper">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Punti reali vs punti stimati per ogni pezzo" className="scatter-chart">
        {/* gridlines + axis ticks */}
        {tickValues.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={margin.top} x2={x(t)} y2={margin.top + plotHeight} className="scatter-gridline" />
            <line x1={margin.left} y1={y(t)} x2={margin.left + plotWidth} y2={y(t)} className="scatter-gridline" />
            <text x={x(t)} y={margin.top + plotHeight + 16} className="scatter-tick-label" textAnchor="middle">{t}</text>
            <text x={margin.left - 8} y={y(t) + 3} className="scatter-tick-label" textAnchor="end">{t}</text>
          </g>
        ))}

        {/* axis labels */}
        <text x={margin.left + plotWidth / 2} y={height - 4} className="scatter-axis-label" textAnchor="middle">Punti reali</text>
        <text x={12} y={margin.top + plotHeight / 2} className="scatter-axis-label" textAnchor="middle" transform={`rotate(-90 12 ${margin.top + plotHeight / 2})`}>Punti stimati</text>

        {/* y = x reference line (perfect estimate) */}
        <line x1={x(0)} y1={y(0)} x2={x(maxValue)} y2={y(maxValue)} className="scatter-reference-line" />

        {/* data points */}
        {rows.map(({ piece, estimate }) => {
          const status = diffStatus(piece.punti, estimate.suggestedPunti);
          const lowConfidence = estimate.breakdown.mechanicConfidence === 'low';
          const cx = x(piece.punti);
          const cy = y(estimate.suggestedPunti);
          const isHovered = hovered === piece.sigla;
          return (
            <g
              key={piece.sigla}
              onMouseEnter={() => setHovered(piece.sigla)}
              onMouseLeave={() => setHovered((h) => (h === piece.sigla ? null : h))}
              className="scatter-point-group"
            >
              <title>{`${piece.sigla} — reali: ${piece.punti}, stimati: ${estimate.suggestedPunti}${lowConfidence ? ' (bassa confidenza)' : ''}`}</title>
              {lowConfidence ? (
                <rect
                  x={cx - 5}
                  y={cy - 5}
                  width={10}
                  height={10}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill={statusColor[status]}
                  className="scatter-point"
                  opacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? '#f8fafc' : 'none'}
                  strokeWidth={1.5}
                />
              ) : (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={statusColor[status]}
                  className="scatter-point"
                  opacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? '#f8fafc' : 'none'}
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="scatter-legend">
        <span className="scatter-legend-item"><span className="scatter-legend-swatch" style={{ background: statusColor.close }} /> vicino (±{CLOSE_ENOUGH_ABS_DIFF})</span>
        <span className="scatter-legend-item"><span className="scatter-legend-swatch" style={{ background: statusColor.over }} /> sovrastimato</span>
        <span className="scatter-legend-item"><span className="scatter-legend-swatch" style={{ background: statusColor.under }} /> sottostimato</span>
        <span className="scatter-legend-item"><span className="scatter-legend-shape scatter-legend-shape-diamond" /> bassa confidenza (1 esempio)</span>
        <span className="scatter-legend-item"><span className="scatter-legend-shape scatter-legend-shape-circle" /> confidenza normale</span>
      </div>
    </div>
  );
}

function PuntiEstimatorScreen() {
  const navigate = useNavigate();
  const quality = estimatorFitQuality();

  const [sortKey, setSortKey] = useState<SortKey>('sigla');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);

  const allRows = useMemo<Row[]>(
    () => sortByPunti(pieces).map((piece) => ({ piece, estimate: estimatePunti(piece) })),
    [],
  );

  const visibleRows = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    const filtered = allRows.filter(({ piece, estimate }) => {
      if (lowConfidenceOnly && estimate.breakdown.mechanicConfidence !== 'low') return false;
      if (query === '') return true;
      return piece.sigla.toLowerCase().includes(query) || piece.descrizione.toLowerCase().includes(query);
    });
    return sortRows(filtered, sortKey, sortDir);
  }, [allRows, filterText, lowConfidenceOnly, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>📊 Stima punti pezzi</h1>
          <p className="subtitle">Punti reali vs. punti suggeriti dall'algoritmo di stima</p>
        </div>
        <button className="btn-reset" onClick={() => navigate('/')}>← Torna alla Home</button>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel">
          <div className="fit-quality-summary">
            <span>Errore medio assoluto: <strong>{quality.meanAbsoluteError.toFixed(1)} pt</strong></span>
            <span>Errore percentuale medio: <strong>{(quality.meanAbsolutePercentError * 100).toFixed(0)}%</strong></span>
            <span>
              Peggiori stime: <strong>{quality.worstFits.map((f) => `${f.sigla} (${f.actual}→${f.suggested})`).join(', ')}</strong>
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>
            L'algoritmo è un modello statistico (regressione ai minimi quadrati) calibrato sul roster attuale.
            È un punto di partenza per la revisione manuale, non un valore definitivo — i pezzi con meccaniche
            speciali (aure, danno ad area, ecc.) hanno una sola voce di esempio nel roster, quindi la loro
            stima è meno affidabile di quella dei pezzi di puro movimento (vedi badge "⚠ 1 esempio" in tabella).
          </p>

          <PuntiScatterChart rows={allRows} />

          <div className="punti-controls">
            <input
              type="text"
              className="punti-filter-input"
              placeholder="Filtra per sigla o nome…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <label className="punti-low-confidence-toggle">
              <input
                type="checkbox"
                checked={lowConfidenceOnly}
                onChange={(e) => setLowConfidenceOnly(e.target.checked)}
              />
              Mostra solo bassa confidenza
            </label>
          </div>

          <div className="punti-table-wrapper">
            <table className="punti-table">
              <thead>
                <tr>
                  <SortableHeader label="Sigla" sortKey="sigla" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th>Nome</th>
                  <SortableHeader label="Punti reali" sortKey="actual" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th>Punti stimati</th>
                  <SortableHeader label="Differenza" sortKey="diff" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th>Dettaglio stima</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ piece, estimate }) => (
                  <tr key={piece.sigla}>
                    <td className="sigla-cell">{piece.sigla}</td>
                    <td>{piece.descrizione}</td>
                    <td>{piece.punti}</td>
                    <td>{estimate.suggestedPunti}</td>
                    <td>
                      <span className={`punti-diff ${diffBadgeClass(piece.punti, estimate.suggestedPunti)}`}>
                        {formatDiff(piece.punti, estimate.suggestedPunti)}
                      </span>
                    </td>
                    <td className="breakdown-cell">
                      mobilità: {estimate.breakdown.mobilityContribution.toFixed(1)}
                      {estimate.breakdown.compoundContribution > 0 && <> · composto: +{estimate.breakdown.compoundContribution.toFixed(1)}</>}
                      {estimate.breakdown.specialMechanicBonus !== 0 && <> · meccanica: {estimate.breakdown.specialMechanicBonus > 0 ? '+' : ''}{estimate.breakdown.specialMechanicBonus.toFixed(1)}</>}
                      {estimate.breakdown.mechanicConfidence === 'low' && (
                        <span
                          className="low-confidence-badge"
                          title={`Bonus basato su un solo esempio nel roster: ${estimate.breakdown.lowConfidenceMechanics.join(', ')}`}
                        >
                          ⚠ 1 esempio
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="punti-table-empty">Nessun pezzo corrisponde al filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PuntiEstimatorScreen;
