import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { costTierClass, pieceBadges } from '../../lib/pieceFormat';
import type { Piece } from '../../types';

interface PieceCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  piece: Piece;
  selected?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Custom cost-badge label — defaults to `${piece.punti} pt`. */
  costLabel?: string;
  showMoves?: boolean;
  showFlags?: boolean;
  showRules?: boolean;
  /** Optional extra content at the bottom of the card (e.g. "Nel team: X/Y"). */
  footer?: ReactNode;
}

function MoveBadges({ piece }: { piece: Piece }) {
  if (!piece.moves || piece.moves.length === 0) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {piece.moves.map((move, idx) => (
        <span key={idx} className="flex items-center gap-1 rounded-sm bg-slate-200 px-1 py-0.5 dark:bg-slate-800">
          <span className="font-mono text-[0.68rem] text-slate-700 dark:text-slate-300">{move.directions.join(',')}</span>
          <span className="text-[0.68rem] font-semibold text-amber-600 dark:text-amber-400">{move.maxSteps === 99 ? '∞' : move.maxSteps}</span>
          {move.capture && <span className="text-[0.65rem] text-red-600 dark:text-red-400">✦</span>}
          {move.jump && <span className="text-[0.65rem] text-blue-600 dark:text-blue-400">⭮</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * The piece card used by every surface that shows pieces (roster, deployment roster, encyclopedia):
 * sigla, cost badge, description, rules, movement badges, flag/action badges and conditional notes.
 * The `.piece-card` class and the inner `.sigla` element are kept, as tests select them.
 */
function PieceCard({
  piece,
  selected = false,
  onClick,
  onKeyDown,
  costLabel = `${piece.punti} pt`,
  showMoves = true,
  showFlags = true,
  showRules = true,
  footer,
  className,
  ...rest
}: PieceCardProps) {
  const badges = pieceBadges(piece);
  return (
    <div
      className={cn(
        'piece-card flex cursor-pointer flex-col gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 transition-all hover:border-blue-400 hover:bg-slate-100 dark:hover:bg-[#162032]',
        selected && 'border-amber-400 bg-amber-50 dark:bg-[#1a1f0a] hover:border-amber-400 hover:bg-amber-100 dark:hover:bg-[#1a1f0a]',
        className,
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...rest}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="sigla text-[0.95rem] font-bold text-slate-900 dark:text-slate-50">{piece.sigla}</span>
        <span className={cn('rounded px-2 py-0.5 text-[0.8rem] font-semibold', costTierClass(piece.punti))}>{costLabel}</span>
      </div>
      <span className="text-[0.8rem] text-slate-600 dark:text-slate-400">{piece.descrizione}</span>
      {showRules && <span className="text-[0.72rem] leading-snug text-slate-500">{piece.regole}</span>}
      {showMoves && <MoveBadges piece={piece} />}
      {showFlags && badges.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span key={badge} className="rounded-sm bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-[0.65rem] text-emerald-600 dark:text-emerald-400">
              {badge}
            </span>
          ))}
        </div>
      )}
      {piece.noteCondizionali && (
        <div className="mt-0.5 text-[0.68rem] italic leading-snug text-sky-700 dark:text-sky-300">{piece.noteCondizionali}</div>
      )}
      {footer}
    </div>
  );
}

export default PieceCard;
