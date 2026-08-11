import { useMemo, useState } from 'react';
import type { ActionModalita, CaptureMode, Direction, MovementType, Piece } from '../types';
import { estimatePunti } from '../data/estimatePunti';
import BreakdownBarChart from './BreakdownBarChart';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';

const ALL_DIRECTIONS: Direction[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const CAPTURE_MODES: CaptureMode[] = ['melee', 'leap', 'ranged', 'none', 'area'];
const MOVEMENT_TYPES: MovementType[] = ['step', 'slide', 'leap', 'speciale'];
const ACTION_MODALITA: ActionModalita[] = ['alternativa', 'aggiuntiva', 'passiva', 'sul_cattura'];

interface DesignerMove {
  id: number;
  directions: Direction[];
  minSteps: number;
  maxSteps: number;
  capture: boolean;
  captureMode: CaptureMode;
  movementType: MovementType;
  jump: boolean;
}

interface DesignerMechanic {
  id: number;
  type: string;
  modalita: ActionModalita;
  /** Semicolon-separated `chiave=valore` pairs; a value containing commas becomes an array (e.g.
   *  `direzioni=n,s,e,w`); `true`/`false` become booleans; anything else numeric becomes a number. */
  paramsText: string;
}

let nextId = 1;
function freshId(): number {
  return nextId++;
}

function defaultMove(): DesignerMove {
  return {
    id: freshId(),
    directions: [...ALL_DIRECTIONS],
    minSteps: 1,
    maxSteps: 1,
    capture: true,
    captureMode: 'melee',
    movementType: 'step',
    jump: false,
  };
}

function defaultMechanic(): DesignerMechanic {
  return { id: freshId(), type: 'nuova_meccanica', modalita: 'passiva', paramsText: 'raggio=1' };
}

/** Parses the designer's "chiave=valore; chiave=valore" mini-syntax into the free-form
 *  `Record<string, unknown>` shape `AlternativeAction.params` actually has — deliberately
 *  JSON-lite rather than requiring real JSON, since this is a quick what-if tool, not a data-entry
 *  form for the real roster (which stays hand-edited in pieces.json). */
function parseMechanicParams(text: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const pair of text.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const rawValue = pair.slice(eq + 1).trim();
    if (!key || !rawValue) continue;
    if (rawValue.includes(',')) {
      params[key] = rawValue.split(',').map((v) => v.trim()).filter(Boolean);
    } else if (rawValue === 'true' || rawValue === 'false') {
      params[key] = rawValue === 'true';
    } else if (!Number.isNaN(Number(rawValue))) {
      params[key] = Number(rawValue);
    } else {
      params[key] = rawValue;
    }
  }
  return params;
}

function toggleDirection(directions: Direction[], direction: Direction): Direction[] {
  return directions.includes(direction) ? directions.filter((d) => d !== direction) : [...directions, direction];
}

const DIRECTION_LABELS: Record<Direction, string> = {
  n: 'N', s: 'S', e: 'E', w: 'O', ne: 'NE', nw: 'NO', se: 'SE', sw: 'SO',
};

/**
 * "What-if" piece designer: builds a hypothetical `Piece` from user-editable moves, resistance,
 * immunities and mechanics, and shows `estimatePunti`'s live suggestion for it — reusing the exact
 * same estimator the roster table uses, no duplicated pricing logic. Purely a simulator: nothing
 * here is ever written to pieces.json, by design (see the banner below) — this tool is for
 * exploring "what would this cost" while designing a piece, not for approving one.
 */
function PieceDesignerPanel() {
  const [moves, setMoves] = useState<DesignerMove[]>([defaultMove()]);
  const [resistance, setResistance] = useState(0);
  const [immunityTypesText, setImmunityTypesText] = useState('');
  const [hasArmatura, setHasArmatura] = useState(false);
  const [armaturaMaxCosto, setArmaturaMaxCosto] = useState(14);
  const [mechanics, setMechanics] = useState<DesignerMechanic[]>([]);

  const hypotheticalPiece = useMemo<Piece>(() => ({
    sigla: 'HP',
    descrizione: 'Pezzo ipotetico',
    punti: 0,
    categoria: 'base',
    classico: false,
    regole: '',
    moves: moves.map((m) => ({
      directions: m.directions,
      minSteps: m.minSteps,
      maxSteps: m.maxSteps,
      capture: m.capture,
      captureMode: m.captureMode,
      movementType: m.movementType,
      ...(m.jump ? { jump: true } : {}),
    })),
    resistance,
    immunityTypes: immunityTypesText.split(',').map((s) => s.trim()).filter(Boolean),
    alternativeActions: mechanics
      .filter((m) => m.type.trim() !== '')
      .map((m) => ({ type: m.type.trim(), modalita: m.modalita, params: parseMechanicParams(m.paramsText) })),
    armatura: hasArmatura,
    armaturaMaxCosto: hasArmatura ? armaturaMaxCosto : undefined,
  }), [moves, resistance, immunityTypesText, mechanics, hasArmatura, armaturaMaxCosto]);

  const estimate = useMemo(() => estimatePunti(hypotheticalPiece), [hypotheticalPiece]);

  const updateMove = (id: number, patch: Partial<DesignerMove>) => {
    setMoves((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const updateMechanic = (id: number, patch: Partial<DesignerMechanic>) => {
    setMechanics((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  return (
    <details className="mb-5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900 dark:text-slate-100">🛠️ Piece designer — simula un pezzo ipotetico</summary>

      <div className="mt-3.5 flex flex-col gap-4">
        <p className="m-0 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-950 p-2.5 text-[0.72rem] text-amber-600 dark:text-amber-400">
          Simulazione — nessun dato viene scritto su pieces.json. Costruisci un pezzo ipotetico qui sotto per vedere
          in tempo reale quanti punti l'algoritmo gli assegnerebbe.
        </p>

        <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5">
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">{estimate.suggestedPunti} pt</div>
          <div className="mb-2 text-xs text-slate-600 dark:text-slate-400">
            intervallo plausibile {estimate.confidenceInterval.low}–{estimate.confidenceInterval.high}
          </div>
          <BreakdownBarChart estimate={estimate} />
        </div>

        <div className="border-t border-slate-300 dark:border-slate-800 pt-3">
          <h4 className="mb-2 text-[0.8rem] text-slate-900 dark:text-slate-100">Mosse</h4>
          {moves.map((move) => (
            <div key={move.id} className="mb-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5">
              <div className="mb-2.5 flex flex-wrap gap-2">
                {ALL_DIRECTIONS.map((d) => (
                  <label key={d} className="flex cursor-pointer flex-row items-center gap-1 text-[0.7rem] text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={move.directions.includes(d)}
                      onChange={() => updateMove(move.id, { directions: toggleDirection(move.directions, d) })}
                    />
                    {DIRECTION_LABELS[d]}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Min passi" className="min-w-[90px]">
                  <input
                    type="number"
                    min={0}
                    value={move.minSteps}
                    onChange={(e) => updateMove(move.id, { minSteps: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Max passi" className="min-w-[90px]">
                  <input
                    type="number"
                    min={0}
                    value={move.maxSteps}
                    onChange={(e) => updateMove(move.id, { maxSteps: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Tipo" className="min-w-[90px]">
                  <select
                    value={move.movementType}
                    onChange={(e) => updateMove(move.id, { movementType: e.target.value as MovementType })}
                    className={inputClass}
                  >
                    {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Cattura" className="min-w-[90px]">
                  <input
                    type="checkbox"
                    checked={move.capture}
                    onChange={(e) => updateMove(move.id, { capture: e.target.checked })}
                    className="size-4 accent-blue-500"
                  />
                </Field>
                <Field label="Modalità cattura" className="min-w-[120px]">
                  <select
                    value={move.captureMode}
                    onChange={(e) => updateMove(move.id, { captureMode: e.target.value as CaptureMode })}
                    className={inputClass}
                  >
                    {CAPTURE_MODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Ignora interposizioni (salto)" className="min-w-[150px]">
                  <input
                    type="checkbox"
                    checked={move.jump}
                    onChange={(e) => updateMove(move.id, { jump: e.target.checked })}
                    className="size-4 accent-blue-500"
                  />
                </Field>
                <Button
                  variant="danger"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => setMoves((prev) => prev.filter((m) => m.id !== move.id))}
                  disabled={moves.length === 1}
                >
                  Rimuovi mossa
                </Button>
              </div>
            </div>
          ))}
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setMoves((prev) => [...prev, defaultMove()])}>
            + Aggiungi mossa
          </Button>
        </div>

        <div className="border-t border-slate-300 dark:border-slate-800 pt-3">
          <h4 className="mb-2 text-[0.8rem] text-slate-900 dark:text-slate-100">Resistenza e immunità</h4>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Resistenza" className="min-w-[90px]">
              <input type="number" min={0} value={resistance} onChange={(e) => setResistance(Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Tipi di immunità (separati da virgola)" className="min-w-[220px] flex-1">
              <input
                type="text"
                placeholder="es. costo<=14, veleno"
                value={immunityTypesText}
                onChange={(e) => setImmunityTypesText(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-slate-300 dark:border-slate-800 pt-3">
          <h4 className="mb-2 text-[0.8rem] text-slate-900 dark:text-slate-100">Armatura naturale</h4>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={hasArmatura} onChange={(e) => setHasArmatura(e.target.checked)} className="size-4 accent-blue-500" />
            Ha armatura naturale
          </label>
          {hasArmatura && (
            <Field label="Costo massimo che può catturarlo" className="mt-2 min-w-[150px]">
              <input
                type="number"
                min={0}
                value={armaturaMaxCosto}
                onChange={(e) => setArmaturaMaxCosto(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <div className="border-t border-slate-300 dark:border-slate-800 pt-3">
          <h4 className="mb-2 text-[0.8rem] text-slate-900 dark:text-slate-100">Meccaniche speciali</h4>
          {mechanics.map((mechanic) => (
            <div key={mechanic.id} className="mb-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Tipo (anche mai visto nel roster, per testare l'estrapolazione)" className="min-w-[220px] flex-1">
                  <input
                    type="text"
                    value={mechanic.type}
                    onChange={(e) => updateMechanic(mechanic.id, { type: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Modalità" className="min-w-[120px]">
                  <select
                    value={mechanic.modalita}
                    onChange={(e) => updateMechanic(mechanic.id, { modalita: e.target.value as ActionModalita })}
                    className={inputClass}
                  >
                    {ACTION_MODALITA.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label={<>Parametri (es. <code className="text-slate-500">raggio=2; direzioni=n,s,e,w; includeAlleati=true</code>)</>} className="min-w-[220px] flex-1">
                  <input
                    type="text"
                    value={mechanic.paramsText}
                    onChange={(e) => updateMechanic(mechanic.id, { paramsText: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Button
                  variant="danger"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => setMechanics((prev) => prev.filter((m) => m.id !== mechanic.id))}
                >
                  Rimuovi meccanica
                </Button>
              </div>
            </div>
          ))}
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setMechanics((prev) => [...prev, defaultMechanic()])}>
            + Aggiungi meccanica
          </Button>
        </div>
      </div>
    </details>
  );
}

export default PieceDesignerPanel;
