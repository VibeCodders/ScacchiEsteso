import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import { pieces, sortByPunti } from '../data/pieces';
import { computePieceRangeSquares } from '../game/pieceInfo';
import { createEmptyBoard, createPieceInstance, setPieceAt, type Coord } from '../game/board';
import { ACTION_LABELS } from '../data/actionLabels';
import type { ActionModalita, Piece } from '../types';
import '../App.css';

const DEMO_ENEMY_SIGLA = 'PE';

const MODALITA_LABELS: Record<ActionModalita, string> = {
  alternativa: 'azione alternativa al movimento',
  aggiuntiva: 'azione aggiuntiva',
  passiva: 'abilità passiva',
  sul_cattura: 'si attiva dopo una cattura',
};

/** One-line description per action type — the encyclopedia's summary, kept in sync with each
 *  piece's `regole` prose in pieces.json. */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  furia_bellica: 'dopo una cattura in mischia ottiene un secondo movimento extra (senza cattura)',
  rianimazione_pedone: 'rianima un Pedone alleato eliminato su una casella vuota adiacente',
  silenzio_aura: 'i pezzi nemici adiacenti perdono gli attacchi a distanza',
  scambio_posizione: 'scambia istantaneamente la posizione con un alleato in linea di vista libera',
  scocca: 'elimina un nemico a 3-4 caselle in linea retta con traiettoria libera, senza muoversi',
  egida: 'protegge gli alleati adiacenti dagli attacchi a distanza',
  danno_ad_area: 'dopo una cattura distrugge i pezzi ortogonalmente adiacenti alla casella di arrivo',
  copia_poteri: 'assume i poteri del pezzo che lo tiene in scacco',
  congelamento: 'congela i nemici adiacenti (mai il Re): nessuna mossa o azione, tranne catturare lo Stunner',
  scambio_due_alleati: 'scambia le posizioni di due alleati adiacenti allo Swapper',
  sdoppiamento: 'crea un clone illusorio su una casella vuota adiacente e sceglie quale dei due è quello vero',
  riunione: 'ricostituisce vero e clone in un unico pezzo, scegliendo la casella in cui ricompare',
};

/** Special abilities a piece carries, in display order: every `alternativeActions` entry, plus
 *  `armatura` (a separate boolean field on Piece, normalized into the same shape). */
function specialAbilitiesOf(piece: Piece): Array<{ label: string; modalita: ActionModalita; description: string }> {
  const abilities = piece.alternativeActions.map((action) => ({
    label: ACTION_LABELS[action.type] ?? action.type,
    modalita: action.modalita,
    description: ACTION_DESCRIPTIONS[action.type] ?? '',
  }));
  if (piece.armatura) {
    abilities.push({
      label: 'Armatura naturale',
      modalita: 'passiva',
      description: `non può essere catturato da pezzi con costo pari o inferiore a ${piece.armaturaMaxCosto ?? 0} punti`,
    });
  }
  return abilities;
}

/** d4 is the default demo square; a few pieces (color-restricted entries) have nothing to show there, so fall back to d5. */
function pickDemoSquare(piece: Piece): Coord {
  const atD4 = computePieceRangeSquares(piece, 'A', 'd4');
  if (atD4.moveSquares.length > 0 || atD4.captureSquares.length > 0) return 'd4';
  return 'd5';
}

function PieceDetail({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const from = pickDemoSquare(piece);
  const { moveSquares, captureSquares, exampleCapture } = computePieceRangeSquares(piece, 'A', from);
  const abilities = specialAbilitiesOf(piece);

  let board = setPieceAt(createEmptyBoard(), from, createPieceInstance(piece.sigla, 'A'));
  if (exampleCapture) {
    board = setPieceAt(board, exampleCapture.enemyAt, createPieceInstance(DEMO_ENEMY_SIGLA, 'B'));
  }

  return (
    <div className="piece-detail-overlay" role="dialog" aria-label={`Dettagli — ${piece.descrizione}`}>
      <div className="piece-detail-panel panel">
        <div className="piece-detail-header">
          <h2>{piece.sigla} — {piece.descrizione}</h2>
          <button className="btn-reset" onClick={onClose}>✕ Chiudi</button>
        </div>
        <p className="regole">{piece.regole}</p>
        <div className="piece-detail-board">
          <Board
            pieces={board}
            orientation="A"
            highlightedSquares={moveSquares}
            captureSquares={captureSquares}
            selectedSquare={from}
          />
        </div>
        <div className="piece-detail-legend">
          <span><span className="legend-swatch legend-move" /> Movimento</span>
          <span><span className="legend-swatch legend-capture" /> Cattura</span>
          <span><span className="legend-swatch legend-both" /> Entrambi</span>
        </div>
        {exampleCapture ? (
          <p className="piece-detail-example">
            Esempio: un pezzo nemico su <strong>{exampleCapture.enemyAt}</strong> verrebbe catturato.
          </p>
        ) : (
          <p className="piece-detail-example">Questo pezzo non ha mosse di cattura di base.</p>
        )}
        {abilities.length > 0 && (
          <div className="piece-detail-actions">
            <h3>🎭 Azioni speciali</h3>
            <ul className="piece-detail-actions-list">
              {abilities.map((ability, idx) => (
                <li key={`${ability.label}-${idx}`}>
                  <strong>{ability.label}</strong>
                  <span className="piece-detail-action-modalita">({MODALITA_LABELS[ability.modalita]})</span>
                  {ability.description && <span> — {ability.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PieceEncyclopediaScreen() {
  const navigate = useNavigate();
  const [selectedSigla, setSelectedSigla] = useState<string | null>(null);
  const selectedPiece = selectedSigla ? (pieces.find((p) => p.sigla === selectedSigla) ?? null) : null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>📖 Enciclopedia dei pezzi</h1>
          <p className="subtitle">Scopri come si muove e cattura ciascun pezzo</p>
        </div>
        <button className="btn-reset" onClick={() => navigate('/')}>← Torna alla Home</button>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel">
          <div className="piece-grid">
            {sortByPunti(pieces).map((piece) => (
              <div key={piece.sigla} className="piece-card">
                <div className="piece-header">
                  <span className="sigla">{piece.sigla}</span>
                  <span className="cost">{piece.punti} pt</span>
                </div>
                <span className="desc">{piece.descrizione}</span>
                <span className="regole">{piece.regole}</span>
                <button className="btn-auto" onClick={() => setSelectedSigla(piece.sigla)}>
                  🔍 Più info
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedPiece && <PieceDetail piece={selectedPiece} onClose={() => setSelectedSigla(null)} />}
    </div>
  );
}

export default PieceEncyclopediaScreen;
