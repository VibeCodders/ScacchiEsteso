import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SimilarPiecesScreen from './SimilarPiecesScreen';
import Home from './Home';
import { GameSetupProvider } from '../context/GameSetupContext';

describe('SimilarPiecesScreen — smoke test', () => {
  it('renders without throwing and shows at least one similar pair', () => {
    render(
      <MemoryRouter>
        <SimilarPiecesScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('🧬 Pezzi simili')).toBeInTheDocument();
    expect(screen.getAllByText(/distanza/).length).toBeGreaterThan(0);
  });

  it('threshold slider changes the visible pairs', () => {
    render(
      <MemoryRouter>
        <SimilarPiecesScreen />
      </MemoryRouter>,
    );
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByText(/Nessuna coppia sotto la soglia/)).toBeInTheDocument();
  });
});

describe('Home — navigation button', () => {
  it('has a button linking to the similar pieces screen', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Pezzi simili/)).toBeInTheDocument();
  });
});
