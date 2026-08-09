import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamSelectScreen from './TeamSelectScreen';
import { KING_SIGLA } from '../data/pieces';
import type { TeamMap } from '../context/gameSetup';

describe('TeamSelectScreen — parametrized team selection', () => {
  it('renders the given title and starts with just the mandatory King', () => {
    render(<TeamSelectScreen title="Composizione Team — Giocatore 1" onComplete={() => {}} />);
    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
    expect(screen.getAllByText('RE')).toHaveLength(2); // roster card + team panel entry
    expect(screen.getByText(/Gratuito — obbligatorio/i)).toBeInTheDocument();
  });

  it('calls onComplete with the current team map when the confirm button is used', () => {
    const onComplete = vi.fn();
    render(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Conferma'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const team = onComplete.mock.calls[0][0] as TeamMap;
    expect(team.get(KING_SIGLA)).toBe(1);
  });

  it('accepts an initialTeam without mutating the caller-owned map', () => {
    const initial: TeamMap = new Map([[KING_SIGLA, 1], ['PE', 3]]);
    const onComplete = vi.fn();
    render(<TeamSelectScreen title="Test" initialTeam={initial} completeButtonLabel="Conferma" onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Conferma'));
    const team = onComplete.mock.calls[0][0] as TeamMap;
    expect(team.get('PE')).toBe(3);

    // The instance must own its own copy — mutating the returned team should not affect the caller's original.
    team.set('PE', 99);
    expect(initial.get('PE')).toBe(3);
  });

  it('keeps state independent across two separate instances (two players)', () => {
    const onCompleteA = vi.fn();
    const onCompleteB = vi.fn();
    const { unmount } = render(<TeamSelectScreen title="Giocatore 1" completeButtonLabel="ConfermaA" onComplete={onCompleteA} />);
    fireEvent.click(screen.getAllByLabelText(/Aggiungi Pedone/i)[0]);
    fireEvent.click(screen.getByText('ConfermaA'));
    const teamA = onCompleteA.mock.calls[0][0] as TeamMap;
    unmount();

    render(<TeamSelectScreen title="Giocatore 2" completeButtonLabel="ConfermaB" onComplete={onCompleteB} />);
    fireEvent.click(screen.getByText('ConfermaB'));
    const teamB = onCompleteB.mock.calls[0][0] as TeamMap;

    expect(teamA.get('PE')).toBe(1);
    expect(teamB.has('PE')).toBe(false);
  });
});
