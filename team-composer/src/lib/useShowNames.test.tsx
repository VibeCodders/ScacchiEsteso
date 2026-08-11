import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useShowNames } from './useShowNames';

/** Dispatch a key event on the given target so the hook's window listeners see it (and its `e.target`). */
function pressH(target: EventTarget, type: 'keydown' | 'keyup') {
  target.dispatchEvent(new KeyboardEvent(type, { key: 'h', bubbles: true }));
}

describe('useShowNames', () => {
  it('starts with names hidden, no toggle and no key held', () => {
    const { result } = renderHook(() => useShowNames());
    expect(result.current.showNames).toBe(false);
    expect(result.current.namesToggled).toBe(false);
    expect(result.current.namesKeyHeld).toBe(false);
  });

  it('shows names while H is held and hides them on release', () => {
    const { result } = renderHook(() => useShowNames());

    act(() => pressH(window, 'keydown'));
    expect(result.current.showNames).toBe(true);
    expect(result.current.namesKeyHeld).toBe(true);
    expect(result.current.namesToggled).toBe(false); // the key alone never touches the toggle

    act(() => pressH(window, 'keyup'));
    expect(result.current.showNames).toBe(false);
    expect(result.current.namesKeyHeld).toBe(false);
  });

  it('the permanent toggle alone keeps names visible without the key', () => {
    const { result } = renderHook(() => useShowNames());

    act(() => result.current.setNamesToggled(true));
    expect(result.current.showNames).toBe(true);
    expect(result.current.namesToggled).toBe(true);
    expect(result.current.namesKeyHeld).toBe(false);

    act(() => result.current.setNamesToggled(false));
    expect(result.current.showNames).toBe(false);
  });

  it('names stay visible while either the toggle or the key is active, and hide only when both are off', () => {
    const { result } = renderHook(() => useShowNames());

    // Toggle on + key held → visible.
    act(() => {
      result.current.setNamesToggled(true);
      pressH(window, 'keydown');
    });
    expect(result.current.showNames).toBe(true);

    // Releasing the key while the toggle is still on → still visible.
    act(() => pressH(window, 'keyup'));
    expect(result.current.showNames).toBe(true);
    expect(result.current.namesKeyHeld).toBe(false);

    // Turning the toggle off too → finally hidden.
    act(() => result.current.setNamesToggled(false));
    expect(result.current.showNames).toBe(false);
  });

  it('turning the toggle off does not clear a held key — names come back while H is still down', () => {
    const { result } = renderHook(() => useShowNames());

    act(() => {
      result.current.setNamesToggled(true);
      pressH(window, 'keydown');
      result.current.setNamesToggled(false);
    });
    expect(result.current.namesToggled).toBe(false);
    expect(result.current.namesKeyHeld).toBe(true);
    expect(result.current.showNames).toBe(true);
  });

  it('ignores H while typing in an input, and reacts again once the input loses focus', () => {
    const { result } = renderHook(() => useShowNames());
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Keystroke inside the focused input must not reveal names.
    act(() => pressH(input, 'keydown'));
    expect(result.current.namesKeyHeld).toBe(false);
    expect(result.current.showNames).toBe(false);

    // Outside an input, the same key does.
    input.blur();
    act(() => pressH(window, 'keydown'));
    expect(result.current.namesKeyHeld).toBe(true);
    expect(result.current.showNames).toBe(true);

    input.remove();
  });

  it('clears the held key when the window loses focus, so names never get stuck on', () => {
    const { result } = renderHook(() => useShowNames());

    act(() => pressH(window, 'keydown'));
    expect(result.current.showNames).toBe(true);

    act(() => window.dispatchEvent(new Event('blur')));
    expect(result.current.namesKeyHeld).toBe(false);
    expect(result.current.showNames).toBe(false);
  });

  it('removes its window listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useShowNames());
    unmount();

    // After unmount the listeners are gone — pressing H must not flip any state.
    act(() => pressH(window, 'keydown'));
    expect(result.current.namesKeyHeld).toBe(false);
  });
});
