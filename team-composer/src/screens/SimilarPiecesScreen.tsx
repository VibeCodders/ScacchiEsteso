import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findSimilarPiecePairs, DEFAULT_SIMILARITY_THRESHOLD } from '../data/similarPieces';
import '../App.css';

function formatDiff(diff: number, siglaA: string, siglaB: string): string {
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)} (${siglaA} rispetto a ${siglaB})`;
}

function SimilarPiecesScreen() {
  const navigate = useNavigate();
  const [threshold, setThreshold] = useState(DEFAULT_SIMILARITY_THRESHOLD);

  const { pairs, comparedPieceCount } = useMemo(() => findSimilarPiecePairs(), []);

  const flagged = useMemo(() => pairs.filter((p) => p.distance <= threshold), [pairs, threshold]);
  const showingFallback = flagged.length === 0;
  const visiblePairs = showingFallback ? pairs.slice(0, 10) : flagged;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🧬 Pezzi simili</h1>
          <p className="subtitle">Coppie di pezzi con mobilità e meccaniche quasi identiche</p>
        </div>
        <button className="btn-reset" onClick={() => navigate('/')}>← Torna alla Home</button>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel">
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>
            Per ogni coppia di pezzi (Re escluso) viene calcolata una distanza tra i profili di mobilità/struttura
            (standardizzati) e le meccaniche speciali — più bassa è la distanza, più i due pezzi si comportano allo
            stesso modo in gioco. Una meccanica speciale non condivisa pesa molto sulla distanza anche a parità di
            mobilità, perché è proprio quello che differenzia due pezzi altrimenti identici.
          </p>

          <div className="similar-pieces-controls">
            <label>
              Soglia di somiglianza
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="similar-pieces-threshold-value">{threshold.toFixed(2)}</span>
            </label>
            <span className="similar-pieces-summary">
              {showingFallback
                ? `Nessuna coppia sotto la soglia — mostro le 10 coppie più simili in assoluto (su ${pairs.length} coppie confrontate, ${comparedPieceCount} pezzi).`
                : `${flagged.length} coppie sotto soglia su ${pairs.length} confrontate (${comparedPieceCount} pezzi, Re escluso).`}
            </span>
          </div>

          <div className="similar-pieces-list">
            {visiblePairs.map(({ a, b, distance, featureDiffs, differingMechanicTypes }) => (
              <div key={`${a.sigla}-${b.sigla}`} className="similar-pieces-card">
                <div className="similar-pieces-card-header">
                  <span className="similar-pieces-pair-label">
                    <strong>{a.sigla}</strong> {a.descrizione} ({a.punti}pt) &nbsp;~&nbsp; <strong>{b.sigla}</strong> {b.descrizione} ({b.punti}pt)
                  </span>
                  <span className={`similar-pieces-distance ${distance < 0.05 ? 'similar-pieces-distance-exact' : ''}`}>
                    distanza {distance.toFixed(2)}
                  </span>
                </div>
                {featureDiffs.length === 0 ? (
                  <p className="similar-pieces-note">Identici su tutte le feature di mobilità/struttura considerate.</p>
                ) : (
                  <ul className="similar-pieces-diff-list">
                    {featureDiffs.map((d) => (
                      <li key={d.name}>{d.name}: {formatDiff(d.diff, a.sigla, b.sigla)}</li>
                    ))}
                  </ul>
                )}
                {differingMechanicTypes.length > 0 && (
                  <p className="similar-pieces-note similar-pieces-mechanic-note">
                    Meccaniche non condivise: {differingMechanicTypes.join(', ')}
                  </p>
                )}
              </div>
            ))}
            {visiblePairs.length === 0 && (
              <p className="punti-table-empty">Nessuna coppia da mostrare.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimilarPiecesScreen;
