import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { MIN_BOARD_DIMENSION, type BoardDimensions } from '../game/board';
import '../App.css';

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
    <div className="app">
      <header className="header">
        <div>
          <h1>⚙️ Impostazioni partita</h1>
          <p className="subtitle">Dimensione della scacchiera e limiti opzionali per questa partita</p>
        </div>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2>📐 Dimensione scacchiera</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Minimo {MIN_BOARD_DIMENSION}×{MIN_BOARD_DIMENSION}. Il budget e il numero massimo di pezzi si adattano
            proporzionalmente all'area della scacchiera (154pt/16 pezzi restano invariati su 8×8).
          </p>
          <div className="actions" style={{ alignItems: 'center' }}>
            <label htmlFor="board-width">Larghezza</label>
            <input
              id="board-width"
              type="number"
              min={MIN_BOARD_DIMENSION}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              style={{ width: '4rem' }}
            />
            <label htmlFor="board-height">Altezza</label>
            <input
              id="board-height"
              type="number"
              min={MIN_BOARD_DIMENSION}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              style={{ width: '4rem' }}
            />
          </div>
          {!widthValid && <p style={{ color: '#f87171' }}>Larghezza non valida (minimo {MIN_BOARD_DIMENSION}).</p>}
          {!heightValid && <p style={{ color: '#f87171' }}>Altezza non valida (minimo {MIN_BOARD_DIMENSION}).</p>}

          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className={width === 8 && height === 8 ? 'btn-save' : 'btn-auto'} onClick={() => { setWidth(8); setHeight(8); }}>
              8×8 (classica)
            </button>
          </div>

          <h2>🧩 Limite tipi di pezzi speciali</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Limita quanti tipi <em>diversi</em> di pezzi non classici ogni team può includere — le copie dello
            stesso tipo contano una volta sola (es. con limite 2: 3 Colossi + 1 Necromante restano validi).
          </p>
          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className={!limitEnabled ? 'btn-save' : 'btn-auto'} onClick={() => setLimitEnabled(false)}>
              Nessun limite
            </button>
            <div className="actions" style={{ alignItems: 'center' }}>
              <button className={limitEnabled ? 'btn-save' : 'btn-auto'} onClick={() => setLimitEnabled(true)}>
                Limita a:
              </button>
              <input
                type="number"
                min={1}
                value={limitValue}
                disabled={!limitEnabled}
                onChange={(e) => setLimitValue(Number(e.target.value))}
                style={{ width: '4rem' }}
              />
            </div>
          </div>

          <div className="actions" style={{ justifyContent: 'center', paddingTop: '1rem' }}>
            <button className="btn-save" disabled={!canContinue} onClick={handleContinue}>
              {canContinue ? 'Continua →' : '✗ Impostazioni non valide'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameSettingsScreen;
