import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pieces, sortByPunti } from '../data/pieces';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import PieceCard from '../components/ui/PieceCard';
import PieceDetail from '../components/ui/PieceDetail';

function PieceEncyclopediaScreen() {
  const navigate = useNavigate();
  const [selectedSigla, setSelectedSigla] = useState<string | null>(null);
  const selectedPiece = selectedSigla ? (pieces.find((p) => p.sigla === selectedSigla) ?? null) : null;

  return (
    <PageShell
      title="📖 Enciclopedia dei pezzi"
      subtitle="Scopri come si muove e cattura ciascun pezzo"
      actions={<Button variant="secondary" onClick={() => navigate('/')}>← Torna alla Home</Button>}
    >
      <Panel>
        <div className="piece-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {sortByPunti(pieces).map((piece) => (
            <PieceCard
              key={piece.sigla}
              piece={piece}
              footer={
                <Button variant="auto" className="w-full py-1.5 text-xs" onClick={() => setSelectedSigla(piece.sigla)}>
                  🔍 Più info
                </Button>
              }
            />
          ))}
        </div>
      </Panel>

      {selectedPiece && <PieceDetail piece={selectedPiece} onClose={() => setSelectedSigla(null)} />}
    </PageShell>
  );
}

export default PieceEncyclopediaScreen;
