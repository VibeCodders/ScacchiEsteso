import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamSelectScreen from './TeamSelectScreen';
import { KING_SIGLA, pickablePieces, sortByPunti } from '../data/pieces';
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

  it('never offers Damone (DM) in the roster — it is obtainable only via promotion', () => {
    render(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    expect(screen.queryByText('DM')).not.toBeInTheDocument();
  });

  it('lists the roster grid sorted by point cost (ascending), sigla as tie-breaker', () => {
    render(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    const renderedSiglas = [...document.querySelectorAll('.piece-card .sigla')].map((el) => el.textContent);
    const expectedSiglas = sortByPunti(pickablePieces).map((p) => p.sigla);
    expect(renderedSiglas).toEqual(expectedSiglas);
  });

  it('lists "Team Attuale" sorted by point cost, ascending, regardless of the order pieces were added', () => {
    render(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    // Add a higher-cost piece before a cheaper one — the display order must not follow click order.
    fireEvent.click(screen.getByLabelText('Aggiungi Regina')); // 48pt — added first
    fireEvent.click(screen.getByLabelText('Aggiungi Pedone')); // 4pt — added second

    const memberSiglas = [...document.querySelectorAll('.team-member .member-sigla')].map((el) => el.textContent);
    expect(memberSiglas).toEqual(['RE', 'PE', 'RA']); // King (0pt) always first, then ascending
  });
});

describe('TeamSelectScreen — optional max-distinct-special-types limit', () => {
  it('shows no special-types validation row when no limit is passed', () => {
    render(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    expect(screen.queryByText(/tipi speciali/i)).not.toBeInTheDocument();
  });

  it('allows confirming a team within the limit, and shows a success row', () => {
    const onComplete = vi.fn();
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['CO', 1], ['NE', 1]]); // 2 distinct special types
    render(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} initialTeam={initialTeam} maxDistinctSpecialTypes={2} />);

    expect(screen.getByText(/Tipi speciali distinti: 2\/2 max/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Conferma'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks confirming a team that exceeds the limit, with an error row', () => {
    const onComplete = vi.fn();
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct special types
    render(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} initialTeam={initialTeam} maxDistinctSpecialTypes={2} />);

    expect(screen.getByText(/Troppi tipi speciali distinti: 3\/2 max/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Vincoli non rispettati/i));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
