import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  it('renders title and children as an accessible modal dialog', () => {
    render(
      <Modal title="Scegli">
        Contenuto
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Scegli');
    expect(screen.getByText('Scegli')).toBeInTheDocument();
    expect(screen.getByText('Contenuto')).toBeInTheDocument();
  });

  it('moves focus to the first focusable element when it opens', () => {
    render(
      <Modal title="Scegli">
        <button>Prima</button>
        <button>Seconda</button>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Prima' })).toHaveFocus();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Scegli" onClose={onClose}>
        <button>Ok</button>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing on Escape when onClose is omitted (non-dismissible dialog)', () => {
    render(
      <Modal title="Scegli">
        <button>Ok</button>
      </Modal>,
    );
    expect(() => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })).not.toThrow();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('traps Tab: from the last element it cycles back to the first', () => {
    render(
      <Modal title="Scegli">
        <button>Prima</button>
        <button>Seconda</button>
      </Modal>,
    );
    const second = screen.getByRole('button', { name: 'Seconda' });
    second.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Prima' })).toHaveFocus();
  });

  it('traps Shift+Tab: from the first element it cycles back to the last', () => {
    render(
      <Modal title="Scegli">
        <button>Prima</button>
        <button>Seconda</button>
      </Modal>,
    );
    const first = screen.getByRole('button', { name: 'Prima' });
    first.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Seconda' })).toHaveFocus();
  });

  it('closes on a backdrop click but not on a click inside the card', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Scegli" onClose={onClose}>
        <button>Ok</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog); // click on the dimmed backdrop itself
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Ok' })); // click inside the card
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element on unmount', () => {
    const outside = document.createElement('button');
    outside.textContent = 'Fuori';
    document.body.appendChild(outside);
    outside.focus();

    const { unmount } = render(
      <Modal title="Scegli">
        <button>Ok</button>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Ok' })).toHaveFocus(); // focus moved inside on open

    unmount();
    expect(outside).toHaveFocus();
    outside.remove();
  });
});
