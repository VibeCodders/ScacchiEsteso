import { useNavigate } from 'react-router-dom';
import { playerLabel, useGameSetup, type MatchResult } from '../context/gameSetup';
import { computeMaterialScore } from '../game/antiStalemate';
import { getPieceDef } from '../game/moveEngine';
import type { Owner } from '../game/board';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import { cn } from '../lib/cn';

function outcomeDescription(result: MatchResult, ownerLabel: (owner: Owner) => string): string {
  const { status, winner } = result;
  if (status === 'checkmate') return `Scacco matto — vince ${ownerLabel(winner!)}`;
  if (status === 'stalemate') return 'Stallo — partita patta';
  return winner
    ? `Limite di 20 turni senza progressi — vince ${ownerLabel(winner)} per punteggio`
    : 'Limite di 20 turni senza progressi — partita patta per punteggio pari';
}

function GameOverScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, matchResult, reset } = useGameSetup();
  const ownerLabel = (owner: Owner) => playerLabel(owner, mode, humanOwner);

  const backToHome = () => {
    reset();
    navigate('/');
  };

  if (!matchResult) {
    return (
      <PageShell title="🏁 Fine Partita" subtitle="Nessun risultato disponibile.">
        <div className="flex justify-center pt-4">
          <Button variant="primary" onClick={backToHome}>Torna alla Home</Button>
        </div>
      </PageShell>
    );
  }

  const { status, finalState } = matchResult;

  // Per-owner statistics, computed from the final position snapshot.
  const remainingPunti: Record<Owner, number> = {
    A: computeMaterialScore(finalState.board, 'A', finalState.dimensions),
    B: computeMaterialScore(finalState.board, 'B', finalState.dimensions),
  };
  const lostPieces: Record<Owner, number> = {
    A: finalState.captured.A.length,
    B: finalState.captured.B.length,
  };
  const lostPunti: Record<Owner, number> = {
    A: finalState.captured.A.reduce((sum, p) => sum + getPieceDef(p.sigla).punti, 0),
    B: finalState.captured.B.reduce((sum, p) => sum + getPieceDef(p.sigla).punti, 0),
  };
  // What each side captured FROM the opponent = the opponent's losses.
  const gainedPunti: Record<Owner, number> = {
    A: lostPunti.B,
    B: lostPunti.A,
  };

  // In drawn outcomes (stalemate, or anti-stalemate with equal points) the points still on the
  // board decide the moral winner — and when the anti-stalemate has an official winner, it simply
  // confirms that same player by points (README §8.2).
  const moralWinner: Owner | undefined =
    remainingPunti.A > remainingPunti.B ? 'A' : remainingPunti.B > remainingPunti.A ? 'B' : undefined;
  const showMoralWinner = status === 'stalemate' || status === 'anti_stalemate';

  return (
    <PageShell
      title="🏁 Fine Partita"
      subtitle={outcomeDescription(matchResult, ownerLabel)}
    >
      <Panel title="📊 Statistiche della partita">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Mosse giocate: <strong className="text-slate-900 dark:text-slate-100">{finalState.history.length}</strong>
          {' '}· catturati totali: <strong className="text-slate-900 dark:text-slate-100">
            {finalState.captured.A.length + finalState.captured.B.length}
          </strong>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {(['A', 'B'] as const).map((owner) => (
            <div
              key={owner}
              className={cn(
                'rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3',
                moralWinner === owner && showMoralWinner && 'border-emerald-400 dark:border-emerald-600',
              )}
            >
              <h3 className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {ownerLabel(owner)}
                {moralWinner === owner && showMoralWinner && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.68rem] font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    🏅 vincitore morale
                  </span>
                )}
              </h3>
              <ul className="space-y-0.5 text-sm text-slate-600 dark:text-slate-400">
                <li>Punti rimasti sulla scacchiera: <strong className="text-slate-900 dark:text-slate-100">{remainingPunti[owner]}</strong></li>
                <li>Catturati all'avversario: <strong className="text-slate-900 dark:text-slate-100">{gainedPunti[owner]} pt</strong></li>
                <li>Pezzi persi: <strong className="text-slate-900 dark:text-slate-100">{lostPieces[owner]}</strong> ({lostPunti[owner]} pt)</li>
              </ul>
            </div>
          ))}
        </div>

        {showMoralWinner && (
          <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {moralWinner
              ? `🏅 Vincitore morale: ${ownerLabel(moralWinner)} — ${Math.max(remainingPunti.A, remainingPunti.B)} pt rimasti contro ${Math.min(remainingPunti.A, remainingPunti.B)}.`
              : '🤝 Punti rimasti pari — nessun vincitore morale.'}
          </p>
        )}
      </Panel>

      <Panel title="📜 Cronologia mosse">
        <div className="max-h-[320px] overflow-y-auto text-sm">
          {finalState.history.length === 0 ? (
            <p className="text-sm text-slate-500">Nessuna mossa.</p>
          ) : (
            <ol className="list-inside list-decimal space-y-0.5 text-slate-700 dark:text-slate-300">
              {finalState.history.map((entry, idx) => (
                <li key={idx}>
                  {ownerLabel(entry.owner)}: {entry.sigla} {entry.from} → {entry.to}
                  {entry.isCapture && ` (cattura ${entry.capturedSigla})`}
                  {entry.isExplosion && ` 💥 esplosione in ${entry.explodedAt}`}
                  {entry.promotedTo && ` → promosso a ${entry.promotedTo}`}
                  {entry.isExtraMove && ' (movimento extra)'}
                  {entry.isRangedAttack && ' (scocca)'}
                  {entry.isSwap && ' (scambio)'}
                  {entry.isSwapperSwap && ` (scambio: ${entry.swapSquares?.join(' ↔ ')})`}
                  {entry.isRepulse && ` (respingi: ${entry.repulsedTo})`}
                  {entry.isTeleport && ' (teletrasporto)'}
                  {entry.isAttract && ` (attira: ${entry.attractedTo})`}
                  {entry.isRevival && ` (rianimato ${entry.revivedSigla})`}
                  {entry.isSdoppiamento && ` (sdoppiamento: vero in ${entry.realSquare}, clone in ${entry.cloneSquare})`}
                  {entry.isMerge && ' (riunione)'}
                  {entry.isCloneCapture && ' (clone eliminato — nessun punto)'}
                  {entry.dispelledClone && ' (clone dissolto)'}
                  {entry.areaDamageCoords && entry.areaDamageCoords.length > 0 && ` 💥 area: ${entry.areaDamageCoords.join(', ')}`}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>

      <div className="flex justify-center pt-4">
        <Button variant="primary" onClick={backToHome}>Torna alla Home</Button>
      </div>
    </PageShell>
  );
}

export default GameOverScreen;
