import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeploymentScreen from './DeploymentScreen';
import { GameSetupProvider } from '../context/GameSetupContext';
import { useGameSetup } from '../context/gameSetup';
import { KING_SIGLA } from '../data/pieces';

function Bootstrap({ teamA, teamB }: { teamA: Map<string, number>; teamB: Map<string, number> }) {
  const { setTeamA, setTeamB, setMode, teamA: currentA } = useGameSetup();
  useEffect(() => {
    setMode('pvp');
    setTeamA(teamA);
    setTeamB(teamB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!currentA) return null; // avoid rendering DeploymentScreen before context is populated
  return <DeploymentScreen />;
}

function renderDeployment(teamA: Map<string, number>, teamB: Map<string, number>) {
  return render(
    <MemoryRouter>
      <GameSetupProvider>
        <Bootstrap teamA={teamA} teamB={teamB} />
      </GameSetupProvider>
    </MemoryRouter>,
  );
}

describe('DeploymentScreen', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic coin toss: always Player A first
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the coin-toss prompt before deployment begins', () => {
    renderDeployment(new Map([[KING_SIGLA, 1]]), new Map([[KING_SIGLA, 1]]));
    expect(screen.getByText(/Tiro a sorte/i)).toBeInTheDocument();
    expect(screen.queryByTestId('board')).not.toBeInTheDocument();
  });

  it('after the coin toss, shows the board with both Kings already placed', () => {
    renderDeployment(new Map([[KING_SIGLA, 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));

    expect(screen.getByTestId('board')).toBeInTheDocument();
    const e1 = document.querySelector('[data-coord="e1"]')!;
    const e8 = document.querySelector('[data-coord="e8"]')!;
    expect(e1.querySelector('svg')).not.toBeNull();
    expect(e8.querySelector('svg')).not.toBeNull();
  });

  it('uses the responsive board-layout class instead of an inline grid override (Step 13d — an inline style would out-rank the layout\'s media query)', () => {
    renderDeployment(new Map([[KING_SIGLA, 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));

    const main = document.querySelector('.main')!;
    expect(main).toHaveClass('main-board-layout');
    expect(main.getAttribute('style') ?? '').not.toContain('grid-template-columns');
  });

  it('completes immediately and offers to continue when both rosters only had the King', () => {
    renderDeployment(new Map([[KING_SIGLA, 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));
    expect(screen.getByText(/Schieramento completo/i)).toBeInTheDocument();
  });

  it('lets the current placer select a piece and place it on an own-rank square', () => {
    renderDeployment(new Map([[KING_SIGLA, 1], ['PE', 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta')); // Player A goes first (mocked)

    fireEvent.click(screen.getByText('PE')); // select the pawn from the roster
    fireEvent.click(document.querySelector('[data-coord="a2"]')!); // within A's ranks (1-2)

    const a2 = document.querySelector('[data-coord="a2"]')!;
    expect(a2.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/Schieramento completo/i)).toBeInTheDocument();
  });

  it('lets the current placer drag a roster piece onto an own-rank square', () => {
    renderDeployment(new Map([[KING_SIGLA, 1], ['PE', 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));

    fireEvent.dragStart(screen.getByText('PE').closest('[draggable]')!, { dataTransfer: { setData: () => {} } });
    fireEvent.drop(document.querySelector('[data-coord="b2"]')!, { dataTransfer: { getData: () => '' } });

    expect(document.querySelector('[data-coord="b2"]')?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/Schieramento completo/i)).toBeInTheDocument();
  });

  it('shows an error and does not place the piece when clicking outside the deployment zone', () => {
    renderDeployment(new Map([[KING_SIGLA, 1], ['PE', 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));

    fireEvent.click(screen.getByText('PE'));
    fireEvent.click(document.querySelector('[data-coord="a5"]')!); // outside A's ranks

    const a5 = document.querySelector('[data-coord="a5"]')!;
    expect(a5.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/Schieramento completo/i)).not.toBeInTheDocument();
  });

  it('the "Vai alla partita" button navigates once deployment is complete', () => {
    renderDeployment(new Map([[KING_SIGLA, 1]]), new Map([[KING_SIGLA, 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));
    expect(screen.getByText(/Vai alla partita/i)).toBeInTheDocument();
  });

  it('"Piazza automaticamente i miei pezzi" places only the current placer\'s roster and hands the turn to the other player', () => {
    renderDeployment(new Map([[KING_SIGLA, 1], ['PE', 1]]), new Map([[KING_SIGLA, 1], ['TO', 1]]));
    fireEvent.click(screen.getByText('Tira la moneta')); // Player A goes first (mocked)

    fireEvent.click(screen.getByText(/Piazza automaticamente i miei pezzi/i));

    // A's Pedone got placed somewhere on the board; B's Torre roster button is now offered instead
    expect(screen.queryByText(/Schieramento completo/i)).not.toBeInTheDocument();
    expect(screen.getByText('TO')).toBeInTheDocument();
  });

  it('"Piazza automaticamente entrambi gli eserciti" completes deployment in one click', () => {
    renderDeployment(new Map([[KING_SIGLA, 1], ['PE', 1]]), new Map([[KING_SIGLA, 1], ['TO', 1]]));
    fireEvent.click(screen.getByText('Tira la moneta'));

    fireEvent.click(screen.getByText(/Piazza automaticamente entrambi gli eserciti/i));

    expect(screen.getByText(/Schieramento completo/i)).toBeInTheDocument();
  });
});
