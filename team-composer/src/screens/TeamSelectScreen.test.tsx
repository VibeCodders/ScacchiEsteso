import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamSelectScreen from './TeamSelectScreen';
import { KING_SIGLA, pickablePieces, sortByPunti, pieces } from '../data/pieces';
import { computeDistinctSpecialTypes, getFormulaMaxIdentical } from '../data/validators';
import type { TeamMap } from '../context/gameSetup';
import { ThemeProvider } from '../context/ThemeContext';

function renderScreen(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('TeamSelectScreen — parametrized team selection', () => {
  it('renders the given title and starts with just the mandatory King', () => {
    renderScreen(<TeamSelectScreen title="Composizione Team — Giocatore 1" onComplete={() => {}} />);
    expect(screen.getByText(/Composizione Team — Giocatore 1/i)).toBeInTheDocument();
    expect(screen.getAllByText('RE')).toHaveLength(2); // roster card + team panel entry
    expect(screen.getByText(/Gratuito — obbligatorio/i)).toBeInTheDocument();
  });

  it('calls onComplete with the current team map when the confirm button is used', () => {
    const onComplete = vi.fn();
    renderScreen(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Conferma'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const team = onComplete.mock.calls[0][0] as TeamMap;
    expect(team.get(KING_SIGLA)).toBe(1);
  });

  it('accepts an initialTeam without mutating the caller-owned map', () => {
    const initial: TeamMap = new Map([[KING_SIGLA, 1], ['PE', 3]]);
    const onComplete = vi.fn();
    renderScreen(<TeamSelectScreen title="Test" initialTeam={initial} completeButtonLabel="Conferma" onComplete={onComplete} />);

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
    const { unmount } = renderScreen(<TeamSelectScreen title="Giocatore 1" completeButtonLabel="ConfermaA" onComplete={onCompleteA} />);
    fireEvent.click(screen.getAllByLabelText(/Aggiungi Pedone/i)[0]);
    fireEvent.click(screen.getByText('ConfermaA'));
    const teamA = onCompleteA.mock.calls[0][0] as TeamMap;
    unmount();

    renderScreen(<TeamSelectScreen title="Giocatore 2" completeButtonLabel="ConfermaB" onComplete={onCompleteB} />);
    fireEvent.click(screen.getByText('ConfermaB'));
    const teamB = onCompleteB.mock.calls[0][0] as TeamMap;

    expect(teamA.get('PE')).toBe(1);
    expect(teamB.has('PE')).toBe(false);
  });

  it('shows the special actions as badges on the roster cards (Miraggio: Sdoppiamento + Riunione)', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);

    const mgCard = screen.getByLabelText(/Aggiungi Miraggio/i).closest('.piece-card');
    expect(mgCard).not.toBeNull();
    expect(mgCard!.textContent).toMatch(/Sdoppiamento/);
    expect(mgCard!.textContent).toMatch(/Riunione/);

    // Other pieces keep their action badges too (Arciere: Scoccare).
    const arCard = screen.getByLabelText(/Aggiungi Arciere/i).closest('.piece-card');
    expect(arCard!.textContent).toMatch(/Scoccare/);
  });

  it('never offers Damone (DM) in the roster — it is obtainable only via promotion', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    expect(screen.queryByText('DM')).not.toBeInTheDocument();
  });

  it('lists the roster grid sorted by point cost (ascending), sigla as tie-breaker', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    const renderedSiglas = [...document.querySelectorAll('.piece-card .sigla')].map((el) => el.textContent);
    const expectedSiglas = sortByPunti(pickablePieces).map((p) => p.sigla);
    expect(renderedSiglas).toEqual(expectedSiglas);
  });

  it('filters the roster by search text, matching name or sigla, combined with the category filter', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    const searchInput = screen.getByLabelText('Cerca pezzo');

    // Search by piece name — only the Miraggio card should remain.
    fireEvent.change(searchInput, { target: { value: 'miraggio' } });
    expect(screen.getByLabelText(/Aggiungi Miraggio/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Aggiungi Pedone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Aggiungi Regina/i)).not.toBeInTheDocument();

    // Search by sigla — matches any piece whose sigla or name contains it (Pedone, Spettro, …).
    fireEvent.change(searchInput, { target: { value: 'PE' } });
    expect(screen.getAllByLabelText(/Aggiungi Pedone/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Aggiungi Miraggio/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Aggiungi Regina/i)).not.toBeInTheDocument();

    // Clearing the search restores the full roster.
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByLabelText(/Aggiungi Miraggio/i)).toBeInTheDocument();

    // A name search can be narrowed further by the "Speciale" filter (Miraggio is speciale).
    fireEvent.change(searchInput, { target: { value: 'miraggio' } });
    fireEvent.click(screen.getByText('Speciali'));
    expect(screen.getByLabelText(/Aggiungi Miraggio/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Classici'));
    expect(screen.queryByLabelText(/Aggiungi Miraggio/i)).not.toBeInTheDocument();
    expect(screen.getByText('Nessun pezzo corrisponde alla ricerca.')).toBeInTheDocument();
  });

  it('lists "Team Attuale" sorted by point cost, ascending, regardless of the order pieces were added', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    // Add a higher-cost piece before a cheaper one — the display order must not follow click order.
    fireEvent.click(screen.getByLabelText('Aggiungi Regina')); // 48pt — added first
    fireEvent.click(screen.getByLabelText('Aggiungi Pedone')); // 4pt — added second

    const memberSiglas = [...document.querySelectorAll('.team-member .member-sigla')].map((el) => el.textContent);
    expect(memberSiglas).toEqual(['PE', 'RE', 'RA']); // ascending by punti: PE (4) < RE (12) < RA (48)
  });
});

describe('TeamSelectScreen — optional max-distinct-special-types limit', () => {
  it('shows no special-types validation row when no limit is passed', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    expect(screen.queryByText(/tipi speciali/i)).not.toBeInTheDocument();
  });

  it('allows confirming a team within the limit, and shows a success row', () => {
    const onComplete = vi.fn();
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['CO', 1], ['NE', 1]]); // 2 distinct special types
    renderScreen(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} initialTeam={initialTeam} maxDistinctSpecialTypes={2} />);

    expect(screen.getByText(/Tipi speciali distinti: 2\/2 max/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Conferma'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks confirming a team that exceeds the limit, with an error row', () => {
    const onComplete = vi.fn();
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct special types
    renderScreen(<TeamSelectScreen title="Test" completeButtonLabel="Conferma" onComplete={onComplete} initialTeam={initialTeam} maxDistinctSpecialTypes={2} />);

    expect(screen.getByText(/Troppi tipi speciali distinti: 3\/2 max/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Vincoli non rispettati/i));
    expect(onComplete).not.toHaveBeenCalled();
  });
});

function memberSiglas(): string[] {
  return [...document.querySelectorAll('.team-member .member-sigla')].map((el) => el.textContent ?? '');
}

describe('TeamSelectScreen — new dynamic per-type cap x = round((d/punti)²)', () => {
  it('explains the new placement rule in the roster panel', () => {
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    expect(screen.getByText(/Regola dinamica per tipo/i)).toBeInTheDocument();
    expect(screen.getByText(/x = round\(\(d \/ punti\)²\)/i)).toBeInTheDocument();
  });

  it('blocks adding more copies of an expensive piece than the formula allows', () => {
    const regina = pieces.find((p) => p.sigla === 'RA')!;
    const raCap = getFormulaMaxIdentical(regina, pieces);
    expect(raCap).toBeLessThan(5); // the formula must actually bind for this test to be meaningful

    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);
    for (let i = 0; i < raCap; i++) {
      fireEvent.click(screen.getByLabelText('Aggiungi Regina'));
    }

    // The card footer shows the effective (formula) cap.
    expect(screen.getByText(new RegExp(`Nel team: ${raCap}/${raCap}`))).toBeInTheDocument();
    // The team panel shows exactly raCap copies…
    expect(screen.getByText(new RegExp(`${regina.punti}pt × ${raCap}`))).toBeInTheDocument();

    // …and an extra click adds nothing.
    fireEvent.click(screen.getByLabelText('Aggiungi Regina'));
    expect(screen.queryByText(new RegExp(`${regina.punti}pt × ${raCap + 1}`))).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${regina.punti}pt × ${raCap}`))).toBeInTheDocument();
  });

  it('still allows a cheap piece up to the old default cap of 5', () => {
    const cheap = [...pickablePieces].filter((p) => p.sigla !== KING_SIGLA && p.punti > 0).sort((a, b) => a.punti - b.punti)[0];
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} />);

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByLabelText(`Aggiungi ${cheap.descrizione}`));
    }
    expect(screen.getByText(new RegExp(`${cheap.punti}pt × 5`))).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`${cheap.punti}pt × 6`))).not.toBeInTheDocument();
  });
});

describe('TeamSelectScreen — "Completa" and "Migliora" respect the distinct-special-types limit', () => {
  it('"Completa" never pushes the team past the configured limit, click after click', () => {
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1]]);
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} initialTeam={initialTeam} maxDistinctSpecialTypes={1} />);

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Completa'));
      const team = new Map(memberSiglas().map((s) => [s, 1]));
      expect(computeDistinctSpecialTypes(team, pieces)).toBeLessThanOrEqual(1);
    }
  });

  it('"Migliora" auto-corrects a team that was already over the limit before optimizing', () => {
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct special types
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} initialTeam={initialTeam} maxDistinctSpecialTypes={2} />);

    expect(screen.getByText(/Troppi tipi speciali distinti/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Migliora'));

    expect(screen.queryByText(/Troppi tipi speciali distinti/i)).not.toBeInTheDocument();
    const team = new Map(memberSiglas().map((s) => [s, 1]));
    expect(computeDistinctSpecialTypes(team, pieces)).toBeLessThanOrEqual(2);
  });

  it('"Migliora" never exceeds the limit while continuing to optimize toward the budget', () => {
    const initialTeam: TeamMap = new Map([[KING_SIGLA, 1], ['PE', 2]]);
    renderScreen(<TeamSelectScreen title="Test" onComplete={() => {}} initialTeam={initialTeam} maxDistinctSpecialTypes={1} />);

    fireEvent.click(screen.getByText('Migliora'));
    const team = new Map(memberSiglas().map((s) => [s, 1]));
    expect(computeDistinctSpecialTypes(team, pieces)).toBeLessThanOrEqual(1);
  });
});
