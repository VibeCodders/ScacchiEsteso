import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Board from '../components/Board';
import { pieces, sortByPunti } from '../data/pieces';
import { computePieceRangeSquares } from '../game/pieceInfo';
import { createEmptyBoard, createPieceInstance, setPieceAt, type Coord } from '../game/board';
import type { Piece } from '../types';
import '../App.css';

const DEMO_ENEMY_SIGLA = 'PE';

/** d4 is the default demo square; a few pieces (color-restricted entries) have nothing to show there, so fall back to d5. */
function pickDemoSquare(piece: Piece): Coord {
  const atD4 = computePieceRangeSquares(piece, 'A', 'd4');
  if (atD4.moveSquares.length > 0 || atD4.captureSquares.length > 0) return 'd4';
  return 'd5';
}

function PieceDetail({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const from = pickDemoSquare(piece);
  const { moveSquares, captureSquares, exampleCapture } = computePieceRangeSquares(piece, 'A', from);

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
