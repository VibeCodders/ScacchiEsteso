import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pieces, PIECE_SORT_COMPARATORS } from '../data/pieces';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import PieceCard from '../components/ui/PieceCard';
import PieceDetail from '../components/ui/PieceDetail';
import { useSortState, sortTable } from '../lib/sort';
import { SortButtons } from '../components/ui/sortable';

function PieceEncyclopediaScreen() {
  const navigate = useNavigate();
  const [selectedSigla, setSelectedSigla] = useState<string | null>(null);
  const selectedPiece = selectedSigla ? (pieces.find((p) => p.sigla === selectedSigla) ?? null) : null;

  const sort = useSortState('price');
  const sortedPieces = useMemo(() => sortTable(pieces, sort.key, sort.dir, PIECE_SORT_COMPARATORS), [sort.key, sort.dir]);

  return (
    <PageShell
      title="📖 Enciclopedia dei pezzi"
      subtitle="Scopri come si muove e cattura ciascun pezzo"
      actions={<Button variant="secondary" onClick={() => navigate('/')}>← Torna alla Home</Button>}
    >
      <Panel>
        <div className="mb-3 flex justify-end">
          <SortButtons
            options={[
              { key: 'price', label: 'Prezzo' },
              { key: 'name', label: 'Nome' },
              { key: 'sigla', label: 'Sigla' },
            ]}
            sort={sort}
          />
        </div>
        <div className="piece-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {sortedPieces.map((piece) => (
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
