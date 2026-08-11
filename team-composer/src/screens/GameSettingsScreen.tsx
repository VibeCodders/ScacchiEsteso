import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { MIN_BOARD_DIMENSION, type BoardDimensions } from '../game/board';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import { cn } from '../lib/cn';

function GameSettingsScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, boardDimensions, maxDistinctSpecialTypes, setBoardDimensions, setMaxDistinctSpecialTypes } = useGameSetup();

  const [width, setWidth] = useState(boardDimensions.width);
  const [height, setHeight] = useState(boardDimensions.height);
  const [limitEnabled, setLimitEnabled] = useState(maxDistinctSpecialTypes != null);
  const [limitValue, setLimitValue] = useState(maxDistinctSpecialTypes ?? 3);

  const widthValid = Number.isInteger(width) && width >= MIN_BOARD_DIMENSION;
  const heightValid = Number.isInteger(height) && height >= MIN_BOARD_DIMENSION;
  const limitValid = !limitEnabled || (Number.isInteger(limitValue) && limitValue >= 1);
  const canContinue = widthValid && heightValid && limitValid;

  const handleContinue = () => {
    if (!canContinue) return;
    const dimensions: BoardDimensions = { width, height };
    setBoardDimensions(dimensions);
    setMaxDistinctSpecialTypes(limitEnabled ? limitValue : null);

    if (mode !== 'pvc') {
      navigate('/team/a');
    } else {
      navigate(humanOwner === 'A' ? '/team/a' : '/team/pc-choice');
    }
  };

  return (
    <PageShell
      title="⚙️ Impostazioni partita"
      subtitle="Dimensione della scacchiera e limiti opzionali per questa partita"
      layout="center"
    >
      <Panel title="📐 Dimensione scacchiera" className="w-full max-w-[480px]">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Minimo {MIN_BOARD_DIMENSION}×{MIN_BOARD_DIMENSION}. Il budget e il numero massimo di pezzi si adattano
          proporzionalmente all'area della scacchiera (230pt/16 pezzi restano invariati su 8×8).
        </p>
        <div className="mt-3 flex items-end gap-4">
          <Field label="Larghezza" htmlFor="board-width">
            <input
              id="board-width"
              type="number"
              min={MIN_BOARD_DIMENSION}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className={cn(inputClass, 'w-16')}
            />
          </Field>
          <Field label="Altezza" htmlFor="board-height">
            <input
              id="board-height"
              type="number"
              min={MIN_BOARD_DIMENSION}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className={cn(inputClass, 'w-16')}
            />
          </Field>
        </div>
        {!widthValid && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Larghezza non valida (minimo {MIN_BOARD_DIMENSION}).</p>}
        {!heightValid && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Altezza non valida (minimo {MIN_BOARD_DIMENSION}).</p>}

        <div className="mt-4">
          <Button
            variant={width === 8 && height === 8 ? 'primary' : 'auto'}
            className="w-full"
            onClick={() => { setWidth(8); setHeight(8); }}
          >
            8×8 (classica)
          </Button>
        </div>
      </Panel>

      <Panel title="🧩 Limite tipi di pezzi speciali" className="w-full max-w-[480px]">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Limita quanti tipi <em>diversi</em> di pezzi non classici ogni team può includere — le copie dello
          stesso tipo contano una volta sola (es. con limite 2: 3 Colossi + 1 Necromante restano validi).
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant={!limitEnabled ? 'primary' : 'auto'} className="w-full" onClick={() => setLimitEnabled(false)}>
            Nessun limite
          </Button>
          <div className="flex items-center gap-3">
            <Button variant={limitEnabled ? 'primary' : 'auto'} className="flex-1" onClick={() => setLimitEnabled(true)}>
              Limita a:
            </Button>
            <input
              type="number"
              min={1}
              value={limitValue}
              disabled={!limitEnabled}
              onChange={(e) => setLimitValue(Number(e.target.value))}
              className={cn(inputClass, 'w-16')}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-center border-t border-slate-300 dark:border-slate-700 pt-4">
          <Button variant="primary" disabled={!canContinue} onClick={handleContinue}>
            {canContinue ? 'Continua →' : '✗ Impostazioni non valide'}
          </Button>
        </div>
      </Panel>
    </PageShell>
  );
}

export default GameSettingsScreen;
