import { useEffect, useState } from 'react';

/**
 * "Show names" mode used by the board screens (game, deployment): piece names are visible while
 * the H key is held down, or permanently once the toggle is switched on. The two combine — names
 * stay visible while either is active. The H key is ignored while typing in an input/textarea.
 */
export function useShowNames() {
  const [toggled, setToggled] = useState(false);
  const [keyHeld, setKeyHeld] = useState(false);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !isTypingTarget(e.target)) setKeyHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setKeyHeld(false);
    };
    const handleBlur = () => setKeyHeld(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return {
    /** Effective visibility: permanent toggle OR the H key being held. */
    showNames: keyHeld || toggled,
    /** Permanent-toggle state (button label: on/off). */
    namesToggled: toggled,
    setNamesToggled: setToggled,
    /** True only while H is physically held down (hint text). */
    namesKeyHeld: keyHeld,
  };
}
