import Board from '../Board';
import { computePieceRangeSquares } from '../../game/pieceInfo';
import { createEmptyBoard, createPieceInstance, setPieceAt, type Coord } from '../../game/board';
import { ACTION_LABELS } from '../../data/actionLabels';
import type { ActionModalita, Piece } from '../../types';
import Button from './Button';

const DEMO_ENEMY_SIGLA = 'PE';

const MODALITA_LABELS: Record<ActionModalita, string> = {
  alternativa: 'azione alternativa al movimento',
  aggiuntiva: 'azione aggiuntiva',
  passiva: 'abilità passiva',
  sul_cattura: 'si attiva dopo una cattura',
};

/** One-line description per action type — the shared summary, kept in sync with each piece's
 *  `regole` prose in pieces.json. Used by the encyclopedia and the in-game "mostra info" modal. */
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
  respingi: 'spinge un nemico adiacente (mai il Re) di una casella lontano da sé, su una casella vuota',
  scambio_due_alleati: 'scambia le posizioni di due alleati adiacenti allo Swapper',
  sdoppiamento: 'crea un clone illusorio su una casella vuota adiacente e sceglie quale dei due è quello vero',
  riunione: 'ricostituisce vero e clone in un unico pezzo, scegliendo la casella in cui ricompare',
};

/** Special abilities a piece carries, in display order: every `alternativeActions` entry, plus
 *  `armatura` (a separate boolean field on Piece, normalized into the same shape). */
export function specialAbilitiesOf(piece: Piece): Array<{ label: string; modalita: ActionModalita; description: string }> {
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

/** The piece-info modal shared by the encyclopedia and the in-game "mostra info" button: name,
 *  rules, a demo board with movement/capture squares, and the special-abilities list. */
function PieceDetail({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const from = pickDemoSquare(piece);
  const { moveSquares, captureSquares, exampleCapture } = computePieceRangeSquares(piece, 'A', from);
  const abilities = specialAbilitiesOf(piece);

  let board = setPieceAt(createEmptyBoard(), from, createPieceInstance(piece.sigla, 'A'));
  if (exampleCapture) {
    board = setPieceAt(board, exampleCapture.enemyAt, createPieceInstance(DEMO_ENEMY_SIGLA, 'B'));
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-black/50 dark:bg-black/85 p-4" role="dialog" aria-label={`Dettagli — ${piece.descrizione}`}>
      <div className="panel flex w-full max-w-[640px] flex-col items-center gap-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="flex w-full items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{piece.sigla} — {piece.descrizione}</h2>
          <Button variant="secondary" onClick={onClose}>✕ Chiudi</Button>
        </div>
        <p className="text-[0.72rem] leading-snug text-slate-500">{piece.regole}</p>
        <div className="max-w-full overflow-x-auto">
          <Board
            pieces={board}
            orientation="A"
            highlightedSquares={moveSquares}
            captureSquares={captureSquares}
            selectedSquare={from}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span><span className="mr-1 inline-block size-3.5 rounded-sm bg-blue-500/75 align-middle" /> Movimento</span>
          <span><span className="mr-1 inline-block size-3.5 rounded-sm bg-red-500/75 align-middle" /> Cattura</span>
          <span><span className="mr-1 inline-block size-3.5 rounded-sm bg-[linear-gradient(135deg,rgba(59,130,246,0.75),rgba(239,68,68,0.75))] align-middle" /> Entrambi</span>
        </div>
        {exampleCapture ? (
          <p className="m-0 text-center text-slate-700 dark:text-slate-300">
            Esempio: un pezzo nemico su <strong>{exampleCapture.enemyAt}</strong> verrebbe catturato.
          </p>
        ) : (
          <p className="m-0 text-center text-slate-700 dark:text-slate-300">Questo pezzo non ha mosse di cattura di base.</p>
        )}
        {abilities.length > 0 && (
          <div className="piece-detail-actions w-full text-left">
            <h3 className="mb-1 text-[0.95rem] text-slate-900 dark:text-slate-50">🎭 Azioni speciali</h3>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {abilities.map((ability, idx) => (
                <li key={`${ability.label}-${idx}`}>
                  <strong className="text-sky-700 dark:text-sky-300">{ability.label}</strong>
                  <span className="ml-1 text-xs text-slate-600 dark:text-slate-400">({MODALITA_LABELS[ability.modalita]})</span>
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

export default PieceDetail;
