import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findSimilarPiecePairs, DEFAULT_SIMILARITY_THRESHOLD } from '../data/similarPieces';
import PieceIcon from '../assets/pieces/pieceIcons';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import { cn } from '../lib/cn';

function formatDiff(diff: number, siglaA: string, siglaB: string): string {
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)} (${siglaA} rispetto a ${siglaB})`;
}

function SimilarPiecesScreen() {
  const navigate = useNavigate();
  const [threshold, setThreshold] = useState(DEFAULT_SIMILARITY_THRESHOLD);

  const { pairs, comparedPieceCount } = useMemo(() => findSimilarPiecePairs(), []);

  const flagged = useMemo(() => pairs.filter((p) => p.distance <= threshold), [pairs, threshold]);
  const showingFallback = flagged.length === 0;
  const visiblePairs = showingFallback ? pairs.slice(0, 10) : flagged;

  return (
    <PageShell
      title="🧬 Pezzi simili"
      subtitle="Coppie di pezzi con mobilità e meccaniche quasi identiche"
      actions={<Button variant="secondary" onClick={() => navigate('/')}>← Torna alla Home</Button>}
    >
      <Panel>
        <p className="mb-4 text-[0.8rem] text-slate-500">
          Per ogni coppia di pezzi (Re escluso) viene calcolata una distanza tra i profili di mobilità/struttura
          (standardizzati) e le meccaniche speciali — più bassa è la distanza, più i due pezzi si comportano allo
          stesso modo in gioco. Una meccanica speciale non condivisa pesa molto sulla distanza anche a parità di
          mobilità, perché è proprio quello che differenzia due pezzi altrimenti identici.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <label className="flex items-center gap-2.5 text-[0.8rem] text-slate-600 dark:text-slate-400">
            Soglia di somiglianza
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-[180px] accent-blue-500"
            />
            <span className="min-w-[2.5em] font-semibold text-slate-900 dark:text-slate-100">{threshold.toFixed(2)}</span>
          </label>
          <span className="text-[0.78rem] text-slate-500">
            {showingFallback
              ? `Nessuna coppia sotto la soglia — mostro le 10 coppie più simili in assoluto (su ${pairs.length} coppie confrontate, ${comparedPieceCount} pezzi).`
              : `${flagged.length} coppie sotto soglia su ${pairs.length} confrontate (${comparedPieceCount} pezzi, Re escluso).`}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {visiblePairs.map(({ a, b, distance, featureDiffs, differingMechanicTypes }) => (
            <div key={`${a.sigla}-${b.sigla}`} className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <PieceIcon sigla={a.sigla} className="size-5 text-slate-700 dark:text-slate-300" />
                    <strong>{a.sigla}</strong>
                  </span>
                  {a.descrizione} ({a.punti}pt)
                  <span className="text-slate-400">~</span>
                  <span className="inline-flex items-center gap-1.5">
                    <PieceIcon sigla={b.sigla} className="size-5 text-slate-700 dark:text-slate-300" />
                    <strong>{b.sigla}</strong>
                  </span>
                  {b.descrizione} ({b.punti}pt)
                </span>
                <span className={cn('whitespace-nowrap rounded bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400', distance < 0.05 && 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400')}>
                  distanza {distance.toFixed(2)}
                </span>
              </div>
              {featureDiffs.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Identici su tutte le feature di mobilità/struttura considerate.</p>
              ) : (
                <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {featureDiffs.map((d) => (
                    <li key={d.name}>{d.name}: {formatDiff(d.diff, a.sigla, b.sigla)}</li>
                  ))}
                </ul>
              )}
              {differingMechanicTypes.length > 0 && (
                <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                  Meccaniche non condivise: {differingMechanicTypes.join(', ')}
                </p>
              )}
            </div>
          ))}
          {visiblePairs.length === 0 && (
            <p className="py-5 text-center text-slate-500">Nessuna coppia da mostrare.</p>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}

export default SimilarPiecesScreen;
