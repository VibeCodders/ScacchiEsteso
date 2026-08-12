import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { LeaveGameContext } from '../context/leaveGame';
import Button from './ui/Button';
import Modal from './ui/Modal';

/**
 * App-level navigation guard for the running match. Rendered ABOVE <Routes> so it stays mounted
 * while the location changes (a guard living inside GameScreen would unmount with it the moment a
 * Back press left /game, before its effect could run). Behavior:
 *
 *  - While on /game the guard is armed. If the browser Back/Forward button (a POP navigation)
 *    leaves /game without the player confirming, the navigation is undone — snap back to /game
 *    with `replace` so the URL stays correct — and the same confirmation dialog the "Torna alla
 *    Home" buttons use is shown.
 *  - Confirming the dialog navigates Home and approves the departure, so the guard lets the
 *    navigation through (and re-arms on the next match).
 *  - Non-POP departures (end-of-match redirect to /game-over, the fallback Home link) are not
 *    the Back button, so they pass untouched.
 *
 * `beforeunload` is NOT the right tool here: it fires only on a real page unload (refresh/close),
 * never on in-app Back navigation, which is what this guard covers.
 */
export function LeaveGameGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const wasInGameRef = useRef(false);
  const leaveApprovedRef = useRef(false);

  useEffect(() => {
    if (location.pathname === '/game') {
      // In the match — arm the guard. A fresh match gets a fresh approval flag.
      wasInGameRef.current = true;
      leaveApprovedRef.current = false;
      return;
    }
    if (navigationType === 'POP' && wasInGameRef.current && !leaveApprovedRef.current) {
      // Back/Forward pressed while in the match without confirmation: undo the navigation and ask.
      navigate('/game', { replace: true });
      setConfirming(true);
      return;
    }
    wasInGameRef.current = false;
  }, [location.pathname, navigationType, navigate]);

  const confirmLeave = () => {
    leaveApprovedRef.current = true;
    setConfirming(false);
    navigate('/');
  };

  return (
    <LeaveGameContext.Provider value={{ openLeaveConfirmation: () => setConfirming(true) }}>
      {children}
      {confirming && (
        <Modal title="🏠 Tornare alla Home?" onClose={() => setConfirming(false)}>
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            La partita in corso andrà persa e tornerai alla schermata iniziale.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="danger" onClick={confirmLeave}>
              Sì, torna alla Home
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Annulla
            </Button>
          </div>
        </Modal>
      )}
    </LeaveGameContext.Provider>
  );
}

export default LeaveGameGuard;
