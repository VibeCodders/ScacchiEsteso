import { useState, useCallback, useMemo } from 'react';
import { pieces, BUDGET, MAX_PIECES_TOTAL, MIN_PIECES_TOTAL, MAX_IDENTICAL, MAX_PAWNS, KING_SIGLA, PAWN_SIGLE } from './data/pieces';
import { autoFillTeam, improveTeam } from './data/optimizer';
import type { Piece, ValidationResult, TeamMember } from './types';
import './App.css';

function getMaxIdentical(sigla: string): number {
  return PAWN_SIGLE.includes(sigla as 'PG' | 'FG' | 'PE') ? MAX_PAWNS : MAX_IDENTICAL;
}

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  message: string;
  type: ToastType;
  id: number;
}

function App() {
  const [team, setTeam] = useState<Map<string, number>>(new Map([[KING_SIGLA, 1]]));
  const [filter, setFilter] = useState<string>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleAutoFill = useCallback(() => {
    const result = autoFillTeam(team);
    if (result.changed) {
      setTeam(result.team);
      addToast(result.message, 'success');
    } else {
      addToast(result.message, 'info');
    }
  }, [team, addToast]);

  const handleImprove = useCallback(() => {
    const result = improveTeam(team);
    if (result.changed) {
      setTeam(result.team);
      addToast(result.message, 'success');
    } else {
      addToast(result.message, 'info');
    }
  }, [team, addToast]);

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
    setTeam(new Map([[KING_SIGLA, 1]]));
  }, []);

  const teamMembers = useMemo(() => {
    const members: TeamMember[] = [];
    team.forEach((count, sigla) => {
      const piece = pieces.find((p: Piece) => p.sigla === sigla);
      if (piece) {
        members.push({ piece, count });
      }
    });
    return members;
  }, [team]);

  const totalPieces = useMemo(() => {
    let total = 0;
    team.forEach((count) => { total += count; });
    return total;
  }, [team]);

  const totalPawns = useMemo(() => {
    let total = 0;
    team.forEach((count, sigla) => {
      if (sigla === 'PG' || sigla === 'FG' || sigla === 'PE') total += count;
    });
    return total;
  }, [team]);

  const budgetSpent = useMemo(() => {
    let spent = 0;
    team.forEach((count, sigla) => {
      const piece = pieces.find((p: Piece) => p.sigla === sigla);
      if (piece) spent += piece.punti * count;
    });
    return spent;
  }, [team]);

  const budgetRemaining = BUDGET - budgetSpent;
  const budgetExact = budgetSpent === BUDGET;

  const kingCount = team.get(KING_SIGLA) ?? 0;
  const hasKing = kingCount === 1;

  const maxIdenticalViolated = useMemo(() => {
    let violated = false;
    team.forEach((count, sigla) => {
      if (count > getMaxIdentical(sigla)) violated = true;
    });
    return violated;
  }, [team]);

  const maxPawnsViolated = totalPawns > MAX_PAWNS;

  const validation = useMemo((): ValidationResult => {
    const budgetOk = budgetSpent === BUDGET;
    const budgetMsg = budgetOk
      ? `Budget esatto: ${budgetSpent}/${BUDGET}`
      : budgetSpent > BUDGET
        ? `Budget superato: ${budgetSpent}/${BUDGET} (+${budgetSpent - BUDGET})`
        : `Budget: ${budgetSpent}/${BUDGET} (${budgetRemaining} rimanenti)`;

    const totalPiecesOk = totalPieces >= MIN_PIECES_TOTAL && totalPieces <= MAX_PIECES_TOTAL;
    const totalPiecesMsg = totalPiecesOk
      ? `Pezzi totali: ${totalPieces} (${MIN_PIECES_TOTAL}–${MAX_PIECES_TOTAL})`
      : totalPieces < MIN_PIECES_TOTAL
        ? `Pezzi insufficienti: ${totalPieces}/${MIN_PIECES_TOTAL} min`
        : `Pezzi in eccesso: ${totalPieces}/${MAX_PIECES_TOTAL} max`;

    const maxFiveOk = !maxIdenticalViolated;
    const maxFiveMsg = maxFiveOk
      ? 'Nessun pezzo supera il proprio limite'
      : 'Alcuni pezzi superano il proprio limite';

    const maxPawnsOk = !maxPawnsViolated;
    const pawnsMsg = maxPawnsOk
      ? `Pedoni: ${totalPawns}/${MAX_PAWNS} max`
      : `Pedoni in eccesso: ${totalPawns}/${MAX_PAWNS}`;

    const hasKingOk = hasKing;
    const kingMsg = hasKingOk ? 'Re presente (1 richiesto)' : 'Re mancante (obbligatorio 1)';

    const kingCountOk = kingCount === 1;
    const kingCountMsg = kingCountOk
      ? 'Esattamente 1 Re'
      : kingCount === 0
        ? 'Nessun Re presente'
        : `Troppi Re: ${kingCount} (1 obbligatorio)`;

    const overall = budgetOk && totalPiecesOk && maxFiveOk && maxPawnsOk && hasKingOk && kingCountOk;

    return {
      budget: { valid: budgetSpent <= BUDGET && budgetExact, message: budgetMsg, level: budgetSpent > BUDGET ? 'error' : budgetExact ? 'success' : 'warning' },
      totalPieces: { valid: totalPiecesOk, message: totalPiecesMsg, level: totalPiecesOk ? 'success' : 'error' },
      maxFive: { valid: maxFiveOk, message: maxFiveMsg, level: maxFiveOk ? 'success' : 'error' },
      maxPawns: { valid: maxPawnsOk, message: pawnsMsg, level: maxPawnsOk ? 'success' : 'error' },
      hasKing: { valid: hasKingOk, message: kingMsg, level: hasKingOk ? 'success' : 'error' },
      kingCount: { valid: kingCountOk, message: kingCountMsg, level: kingCountOk ? 'success' : 'error' },
      overall,
    };
  }, [budgetSpent, budgetRemaining, budgetExact, totalPieces, totalPawns, maxIdenticalViolated, maxPawnsViolated, hasKing, kingCount]);

  const filteredPieces = filter === 'all' ? pieces : pieces.filter((p: Piece) => p.classico === (filter === 'classico'));

  const getCostClass = (cost: number) => {
    if (cost === 0) return 'cost-free';
    if (cost <= 10) return 'cost-low';
    if (cost <= 25) return 'cost-med';
    return 'cost-high';
  };

  const flagLabels: Record<string, string> = {
    saltaInterposizioni: 'Salta interposizioni',
    catturaSoloInMischia: 'Solo mischia',
    catturaADistanza: 'A distanza',
    secondoMovimentoPostCattura: '2° mov. post-cattura',
    dannoAdArea: 'Danno area',
    rianimaPedoni: 'Rianima pedoni',
    silenzioAttacchiADistanza: 'Silenzio',
    armatura: 'Armatura',
    scambiaPosizioneConAlleato: 'Scambia pos.',
    scocca: 'Scocca',
    egida: 'Egida',
  };

  const activeFlags = (piece: Piece) => {
    const flags: string[] = [];
    for (const [key, label] of Object.entries(flagLabels)) {
      if (piece[key as keyof Piece]) flags.push(label);
    }
    return flags;
  };

  const renderMoves = (piece: Piece) => {
    if (!piece.moves || piece.moves.length === 0) return null;
    return (
      <div className="moves-info">
        {piece.moves.map((move, idx) => (
          <span key={idx} className="move-item">
            <span className="move-dir">{move.directions.join(',')}</span>
            <span className="move-step">{move.maxSteps === 99 ? '∞' : move.maxSteps}</span>
            {move.capture && <span className="move-capture">✦</span>}
            {move.jump && <span className="move-jump">⭮</span>}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>⚔️ Composizione Team</h1>
          <p className="subtitle">Scacchi Esteso — Budget 154 punti</p>
        </div>
        <div className="budget-badge">
          <span className="label">Budget:</span>
          <span className={`value ${budgetSpent > BUDGET ? 'err' : budgetExact ? 'ok' : budgetSpent > BUDGET * 0.9 ? 'warn' : ''}`}>
            {budgetSpent}/{BUDGET}
          </span>
        </div>
      </header>

      <div className="main">
        <div className="panel">
          <h2>📦 Roster Pezzi</h2>
          <div className="piece-filter">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Tutti</button>
            <button className={`filter-btn ${filter === 'classico' ? 'active' : ''}`} onClick={() => setFilter('classico')}>Classici</button>
            <button className={`filter-btn ${filter === 'speciale' ? 'active' : ''}`} onClick={() => setFilter('speciale')}>Speciali</button>
          </div>
          <div className="piece-grid">
            {filteredPieces.map((piece: Piece) => {
              const currentCount = team.get(piece.sigla) ?? 0;
              const maxForPiece = getMaxIdentical(piece.sigla);
              const isMaxed = currentCount >= maxForPiece;
              const isKing = piece.sigla === KING_SIGLA;
              return (
                <div
                  key={piece.sigla}
                  className={`piece-card ${currentCount > 0 ? 'selected' : ''}`}
                  onClick={() => !isMaxed && !isKing && addPiece(piece)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Aggiungi ${piece.descrizione}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isMaxed && !isKing) addPiece(piece); } }}
                >
                  <div className="piece-header">
                    <span className="sigla">{piece.sigla}</span>
                    <span className={`cost ${getCostClass(piece.punti)}`}>{piece.punti} pt</span>
                  </div>
                  <span className="desc">{piece.descrizione}</span>
                  <span className="regole">{piece.regole}</span>
                  {renderMoves(piece)}
                  {(() => {
                    const flags = activeFlags(piece);
                    return flags.length > 0 ? (
                      <div className="flags">
                        {flags.map((f) => (
                          <span key={f} className="flag-badge">{f}</span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {piece.noteCondizionali && <div className="note-cond">{piece.noteCondizionali}</div>}
                  {currentCount > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                      Nel team: {currentCount}/{maxForPiece}
                    </span>
                  )}
                  {isMaxed && <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Limite raggiunto</span>}
                  {isKing && <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Gratuito — obbligatorio</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel composer-panel">
          <h2>🎯 Team Attuale</h2>

          {teamMembers.length === 0 ? (
            <div className="empty-state">Il Re è obbligatorio e viene sempre incluso nel team.<br />Aggiungi altri pezzi per completare il team.</div>
          ) : (
            <>
              <div className="team-list">
{teamMembers.map(({ piece, count }) => {
                  const isKing = piece.sigla === KING_SIGLA;
                  return (
                    <div key={piece.sigla} className={`team-member ${isKing ? 'king-member' : ''}`}>
                      <div className="member-info">
                        <span className="member-sigla">{piece.sigla}</span>
                        <span className="member-name">{piece.descrizione}</span>
                        <span className="member-cost">{piece.punti}pt × {count} = {piece.punti * count}</span>
                      </div>
                      <div className="member-count">
                        {!isKing && <button className="count-btn" onClick={() => removePiece(piece.sigla)} aria-label={`Rimuovi un ${piece.descrizione}`}>−</button>}
                        <span className="count-num">{count}</span>
                        {!isKing && <button className="count-btn" onClick={() => addPiece(piece)} aria-label={`Aggiungi un ${piece.descrizione}`} disabled={count >= getMaxIdentical(piece.sigla)}>+</button>}
                        {!isKing && <button className="remove-btn" onClick={() => removeAll(piece.sigla)} aria-label={`Rimuovi tutti i ${piece.descrizione}`}>✕</button>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="summary">
                <div className="summary-row">
                  <span className="label">Pezzi totali</span>
                  <span className={`value ${totalPieces >= MIN_PIECES_TOTAL && totalPieces <= MAX_PIECES_TOTAL ? 'ok' : 'err'}`}>{totalPieces} ({MIN_PIECES_TOTAL}–{MAX_PIECES_TOTAL})</span>
                </div>
                <div className="summary-row">
                  <span className="label">Pedoni</span>
                  <span className={`value ${totalPawns <= MAX_PAWNS ? 'ok' : 'err'}`}>{totalPawns}/{MAX_PAWNS}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Re</span>
                  <span className={`value ${hasKing ? 'ok' : 'err'}`}>{hasKing ? '✓ Presente' : '✗ Mancante'}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Budget speso</span>
                  <span className={`value ${budgetSpent > BUDGET ? 'err' : budgetExact ? 'ok' : 'warn'}`}>{budgetSpent}/{BUDGET}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Budget residuo</span>
                  <span className={`value ${budgetRemaining < 0 ? 'err' : budgetRemaining === 0 ? 'ok' : 'warn'}`}>{budgetRemaining}</span>
                </div>
              </div>

              <div className="validation">
                <div className={`validation-item ${validation.budget.level}`}>
                  <span className="icon">{validation.budget.valid ? '✓' : '✗'}</span>
                  <span>{validation.budget.message}</span>
                </div>
                <div className={`validation-item ${validation.totalPieces.level}`}>
                  <span className="icon">{validation.totalPieces.valid ? '✓' : '✗'}</span>
                  <span>{validation.totalPieces.message}</span>
                </div>
                <div className={`validation-item ${validation.maxFive.level}`}>
                  <span className="icon">{validation.maxFive.valid ? '✓' : '✗'}</span>
                  <span>{validation.maxFive.message}</span>
                </div>
                <div className={`validation-item ${validation.maxPawns.level}`}>
                  <span className="icon">{validation.maxPawns.valid ? '✓' : '✗'}</span>
                  <span>{validation.maxPawns.message}</span>
                </div>
                <div className={`validation-item ${validation.hasKing.level}`}>
                  <span className="icon">{validation.hasKing.valid ? '✓' : '✗'}</span>
                  <span>{validation.hasKing.message}</span>
                </div>
                <div className={`validation-item ${validation.kingCount.level}`}>
                  <span className="icon">{validation.kingCount.valid ? '✓' : '✗'}</span>
                  <span>{validation.kingCount.message}</span>
                </div>
              </div>

              <div className="actions">
                <button className="btn-reset" onClick={resetTeam}>Reset Team</button>
                <button className="btn-auto" onClick={handleAutoFill}>Completa</button>
                <button className="btn-improve" onClick={handleImprove}>Migliora</button>
                <button className="btn-save" disabled={!validation.overall}>
                  {validation.overall ? '✓ Team Completo' : '✗ Vincoli non rispettati'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App