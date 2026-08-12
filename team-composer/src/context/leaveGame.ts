import { createContext, useContext } from 'react';

/** Lets a screen (currently GameScreen's "Torna alla Home" buttons) ask the guard to show the
 *  leave-the-match confirmation dialog. */
export interface LeaveGameContextValue {
  openLeaveConfirmation: () => void;
}

export const LeaveGameContext = createContext<LeaveGameContextValue>({
  openLeaveConfirmation: () => {},
});

export function useLeaveGame(): LeaveGameContextValue {
  return useContext(LeaveGameContext);
}
