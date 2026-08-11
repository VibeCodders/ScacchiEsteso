import { useState, useCallback, useMemo } from 'react';
import { pieces, pickablePieces, rules, sortByPunti, scaleRulesForBoardSize, KING_SIGLA } from '../data/pieces';
import { autoFillTeam, improveTeam } from '../data/optimizer';
import { getMaxIdenticalBySigla, countByCategory, computeValidation } from '../data/validators';
import { emptyTeam, type TeamMap } from '../context/gameSetup';
import { DEFAULT_BOARD_DIMENSIONS, type BoardDimensions } from '../game/board';
import type { Piece, TeamMember } from '../types';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import PieceCard from '../components/ui/PieceCard';
import { ToastContainer } from '../components/ui/Toasts';
import { useToasts } from '../components/ui/useToasts';
import { cn } from '../lib/cn';

function getMaxIdentical(sigla: string): number {
  return getMaxIdenticalBySigla(sigla, pieces, rules);
}

export interface TeamSelectScreenProps {
  title: string;
  subtitle?: string;
  initialTeam?: TeamMap;
  completeButtonLabel?: string;
  onComplete: (team: TeamMap) => void;
  /** Max number of *distinct* non-classic siglas allowed this match. undefined/null = unlimited. */
  maxDistinctSpecialTypes?: number | null;
  /** Board size for this match — budget and max-piece-count scale with its area. Defaults to the classic 8×8. */
  boardDimensions?: BoardDimensions;
}

type Filter = 'all' | 'classico' | 'speciale';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tutti' },
  { id: 'classico', label: 'Classici' },
  { id: 'speciale', label: 'Speciali' },
];

const VALIDATION_LEVEL_CLASSES: Record<string, string> = {
  error: 'bg-red-950 text-red-300',
  warning: 'bg-amber-950 text-amber-200',
  success: 'bg-green-950 text-green-300',
};

function TeamSelectScreen({
  title, subtitle, initialTeam, completeButtonLabel, onComplete,
  maxDistinctSpecialTypes = null, boardDimensions = DEFAULT_BOARD_DIMENSIONS,
}: TeamSelectScreenProps) {
  const [team, setTeam] = useState<TeamMap>(() => (initialTeam ? new Map(initialTeam) : emptyTeam()));
  const [filter, setFilter] = useState<Filter>('all');
  const { toasts, addToast } = useToasts();

  const effectiveRules = useMemo(() => scaleRulesForBoardSize(rules, boardDimensions), [boardDimensions]);
  const BUDGET = effectiveRules.budget;
  const MAX_PIECES_TOTAL = effectiveRules.maxPiecesTotal;

  const handleAutoFill = useCallback(() => {
    const result = autoFillTeam(team, effectiveRules, maxDistinctSpecialTypes);
    if (result.changed) {
      setTeam(result.team);
      addToast(result.message, 'success');
    } else {
      addToast(result.message, 'info');
    }
  }, [team, addToast, effectiveRules, maxDistinctSpecialTypes]);

  const handleImprove = useCallback(() => {
    const result = improveTeam(team, effectiveRules, maxDistinctSpecialTypes);
    if (result.changed) {
      setTeam(result.team);
      addToast(result.message, 'success');
    } else {
      addToast(result.message, 'info');
    }
  }, [team, addToast, effectiveRules, maxDistinctSpecialTypes]);

  const addPiece = useCallback((piece: Piece) => {
    if (piece.sigla === KING_SIGLA) return;
    setTeam((prev) => {
      const next = new Map(prev);
      const current = next.get(piece.sigla) ?? 0;
      if (current >= getMaxIdentical(piece.sigla)) return prev;
      next.set(piece.sigla, current + 1);
      return next;
    });
  }, []);

  const removePiece = useCallback((sigla: string) => {
    if (sigla === KING_SIGLA) return;
    setTeam((prev) => {
      const next = new Map(prev);
      const current = next.get(sigla) ?? 0;
      if (current <= 1) {
        next.delete(sigla);
      } else {
        next.set(sigla, current - 1);
      }
      return next;
    });
  }, []);

  const removeAll = useCallback((sigla: string) => {
    if (sigla === KING_SIGLA) return;
    setTeam((prev) => {
      const next = new Map(prev);
      next.delete(sigla);
      return next;
    });
  }, []);

  const resetTeam = useCallback(() => {
    setTeam(emptyTeam());
  }, []);

  const teamMembers = useMemo(() => {
    const members: TeamMember[] = [];
    team.forEach((count, sigla) => {
      const piece = pieces.find((p: Piece) => p.sigla === sigla);
      if (piece) {
        members.push({ piece, count });
      }
    });
    return members.sort((a, b) => a.piece.punti - b.piece.punti || a.piece.sigla.localeCompare(b.piece.sigla));
  }, [team]);

  const totalPieces = useMemo(() => {
    let total = 0;
    team.forEach((count) => { total += count; });
    return total;
  }, [team]);

  const totalPawns = useMemo(() => countByCategory(team, pieces, 'pedone'), [team]);

  const budgetSpent = useMemo(() => {
    let spent = 0;
    team.forEach((count, sigla) => {
      const piece = pieces.find((p: Piece) => p.sigla === sigla);
      if (piece) spent += piece.punti * count;
    });
    return spent;
  }, [team]);

  const budgetRemaining = BUDGET - budgetSpent;
  const budgetOk = budgetSpent <= BUDGET;

  const kingCount = team.get(KING_SIGLA) ?? 0;
  const hasKing = kingCount === 1;

  const validation = useMemo(
    () => computeValidation(team, pieces, effectiveRules, maxDistinctSpecialTypes),
    [team, maxDistinctSpecialTypes, effectiveRules],
  );

  const filteredPieces = sortByPunti(
    filter === 'all' ? pickablePieces : pickablePieces.filter((p: Piece) => p.classico === (filter === 'classico')),
  );

  const summaryRows = [
    { label: 'Pezzi totali', value: `${totalPieces} (max ${MAX_PIECES_TOTAL})`, tone: totalPieces <= MAX_PIECES_TOTAL ? 'ok' : 'err' },
    { label: 'Pedoni', value: `${totalPawns}/${rules.maxCountByCategory.pedone}`, tone: validation.maxPawns.valid ? 'ok' : 'err' },
    { label: 'Re', value: hasKing ? '✓ Presente' : '✗ Mancante', tone: hasKing ? 'ok' : 'err' },
    { label: 'Budget speso', value: `${budgetSpent}/${BUDGET}`, tone: budgetOk ? 'ok' : 'err' },
    { label: 'Budget residuo', value: `${budgetRemaining}`, tone: budgetRemaining < 0 ? 'err' : budgetRemaining === 0 ? 'ok' : 'warn' },
  ] as const;

  const validationItems = [
    validation.budget,
    validation.totalPieces,
    validation.maxFive,
    validation.maxPawns,
    validation.hasKing,
    validation.kingCount,
    ...(maxDistinctSpecialTypes != null ? [validation.specialTypesLimit] : []),
  ];

  return (
    <PageShell
      title={`⚔️ ${title}`}
      subtitle={subtitle ?? `Scacchi Esteso — Budget ${BUDGET} punti`}
      layout="two"
      actions={
        <Badge tone={budgetOk ? 'ok' : 'err'} className="text-base">
          Budget: <span className="font-bold">{budgetSpent}/{BUDGET}</span>
        </Badge>
      }
    >
      <Panel title="📦 Roster Pezzi">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              variant={filter === f.id ? 'primary' : 'ghost'}
              className="px-2.5 py-1 text-xs"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="piece-grid grid max-h-[600px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5 overflow-y-auto pr-1">
          {filteredPieces.map((piece: Piece) => {
            const currentCount = team.get(piece.sigla) ?? 0;
            const maxForPiece = getMaxIdentical(piece.sigla);
            const isMaxed = currentCount >= maxForPiece;
            const isKing = piece.sigla === KING_SIGLA;
            return (
              <PieceCard
                key={piece.sigla}
                piece={piece}
                selected={currentCount > 0}
                role="button"
                tabIndex={0}
                aria-label={`Aggiungi ${piece.descrizione}`}
                onClick={() => !isMaxed && !isKing && addPiece(piece)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isMaxed && !isKing) addPiece(piece);
                  }
                }}
                footer={
                  <>
                    {currentCount > 0 && (
                      <span className="text-[0.75rem] text-blue-400">Nel team: {currentCount}/{maxForPiece}</span>
                    )}
                    {isMaxed && <span className="text-[0.75rem] text-red-400">Limite raggiunto</span>}
                    {isKing && <span className="text-[0.75rem] text-amber-400">Gratuito — obbligatorio</span>}
                  </>
                }
              />
            );
          })}
        </div>
      </Panel>

      <Panel title="🎯 Team Attuale" className="flex flex-col gap-4">
        {teamMembers.length === 0 ? (
          <div className="py-5 text-center text-sm text-slate-500">
            Il Re è obbligatorio e viene sempre incluso nel team.<br />Aggiungi altri pezzi per completare il team.
          </div>
        ) : (
          <>
            <div className="team-list flex max-h-[400px] flex-col gap-1.5 overflow-y-auto">
              {teamMembers.map(({ piece, count }) => {
                const isKing = piece.sigla === KING_SIGLA;
                return (
                  <div
                    key={piece.sigla}
                    className={cn(
                      'team-member flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-3 py-2',
                      isKing && 'border-amber-400 bg-[#1a1f0a]',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="member-sigla w-10 text-sm font-bold">{piece.sigla}</span>
                      <span className="text-sm text-slate-300">{piece.descrizione}</span>
                      <span className="text-[0.8rem] text-slate-400">{piece.punti}pt × {count} = {piece.punti * count}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isKing && (
                        <button
                          className="flex size-6 cursor-pointer items-center justify-center rounded border border-slate-600 bg-slate-800 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => removePiece(piece.sigla)}
                          aria-label={`Rimuovi un ${piece.descrizione}`}
                        >−</button>
                      )}
                      <span className="min-w-4 text-center text-sm font-semibold">{count}</span>
                      {!isKing && (
                        <button
                          className="flex size-6 cursor-pointer items-center justify-center rounded border border-slate-600 bg-slate-800 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => addPiece(piece)}
                          aria-label={`Aggiungi un ${piece.descrizione}`}
                          disabled={count >= getMaxIdentical(piece.sigla)}
                        >+</button>
                      )}
                      {!isKing && (
                        <button
                          className="cursor-pointer rounded p-0.5 text-base text-red-400 hover:bg-red-950/60"
                          onClick={() => removeAll(piece.sigla)}
                          aria-label={`Rimuovi tutti i ${piece.descrizione}`}
                        >✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3">
              {summaryRows.map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{row.label}</span>
                  <span
                    className={cn(
                      'font-semibold',
                      row.tone === 'ok' && 'text-emerald-400',
                      row.tone === 'warn' && 'text-amber-400',
                      row.tone === 'err' && 'text-red-400',
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-1 flex flex-col gap-1">
              {validationItems.map((item) => (
                <div
                  key={item.message}
                  className={cn('flex items-center gap-1.5 rounded px-2 py-1 text-[0.8rem]', VALIDATION_LEVEL_CLASSES[item.level])}
                >
                  <span className="text-sm">{item.valid ? '✓' : '✗'}</span>
                  <span>{item.message}</span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={resetTeam}>Reset Team</Button>
              <Button variant="auto" className="flex-1" onClick={handleAutoFill}>Completa</Button>
              <Button variant="improve" className="flex-1" onClick={handleImprove}>Migliora</Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!validation.overall}
                onClick={() => validation.overall && onComplete(team)}
              >
                {validation.overall ? (completeButtonLabel ?? '✓ Team Completo') : '✗ Vincoli non rispettati'}
              </Button>
            </div>
          </>
        )}
      </Panel>

      <ToastContainer toasts={toasts} />
    </PageShell>
  );
}

export default TeamSelectScreen;
