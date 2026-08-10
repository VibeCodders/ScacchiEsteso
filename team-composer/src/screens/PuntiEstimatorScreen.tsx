import { useNavigate } from 'react-router-dom';
import { pieces, sortByPunti } from '../data/pieces';
import { estimatePunti, estimatorFitQuality } from '../data/estimatePunti';
import '../App.css';

/** How close is "close enough" before a suggestion counts as a meaningful over/under estimate. */
const CLOSE_ENOUGH_ABS_DIFF = 3;

function diffBadgeClass(actual: number, suggested: number): string {
  const diff = suggested - actual;
  if (Math.abs(diff) <= CLOSE_ENOUGH_ABS_DIFF) return 'punti-diff-close';
  return diff > 0 ? 'punti-diff-over' : 'punti-diff-under';
}

function formatDiff(actual: number, suggested: number): string {
  const diff = suggested - actual;
  if (diff === 0) return '0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function PuntiEstimatorScreen() {
  const navigate = useNavigate();
  const quality = estimatorFitQuality();

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>📊 Stima punti pezzi</h1>
          <p className="subtitle">Punti reali vs. punti suggeriti dall'algoritmo di stima</p>
        </div>
        <button className="btn-reset" onClick={() => navigate('/')}>← Torna alla Home</button>
      </header>

      <div className="main" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel">
          <div className="fit-quality-summary">
            <span>Errore medio assoluto: <strong>{quality.meanAbsoluteError.toFixed(1)} pt</strong></span>
            <span>Errore percentuale medio: <strong>{(quality.meanAbsolutePercentError * 100).toFixed(0)}%</strong></span>
            <span>
              Peggiori stime: <strong>{quality.worstFits.map((f) => `${f.sigla} (${f.actual}→${f.suggested})`).join(', ')}</strong>
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>
            L'algoritmo è un modello statistico (regressione ai minimi quadrati) calibrato sul roster attuale.
            È un punto di partenza per la revisione manuale, non un valore definitivo — i pezzi con meccaniche
            speciali (aure, danno ad area, ecc.) hanno una sola voce di esempio nel roster, quindi la loro
            stima è meno affidabile di quella dei pezzi di puro movimento.
          </p>

          <div className="punti-table-wrapper">
            <table className="punti-table">
              <thead>
                <tr>
                  <th>Sigla</th>
                  <th>Nome</th>
                  <th>Punti reali</th>
                  <th>Punti stimati</th>
                  <th>Differenza</th>
                  <th>Dettaglio stima</th>
                </tr>
              </thead>
              <tbody>
                {sortByPunti(pieces).map((piece) => {
                  const estimate = estimatePunti(piece);
                  return (
                    <tr key={piece.sigla}>
                      <td className="sigla-cell">{piece.sigla}</td>
                      <td>{piece.descrizione}</td>
                      <td>{piece.punti}</td>
                      <td>{estimate.suggestedPunti}</td>
                      <td>
                        <span className={`punti-diff ${diffBadgeClass(piece.punti, estimate.suggestedPunti)}`}>
                          {formatDiff(piece.punti, estimate.suggestedPunti)}
                        </span>
                      </td>
                      <td className="breakdown-cell">
                        mobilità: {estimate.breakdown.mobilityContribution.toFixed(1)}
                        {estimate.breakdown.compoundContribution > 0 && <> · composto: +{estimate.breakdown.compoundContribution.toFixed(1)}</>}
                        {estimate.breakdown.specialMechanicBonus !== 0 && <> · meccanica: {estimate.breakdown.specialMechanicBonus > 0 ? '+' : ''}{estimate.breakdown.specialMechanicBonus.toFixed(1)}</>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PuntiEstimatorScreen;
