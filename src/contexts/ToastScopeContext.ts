import { createContext } from "react";

/**
 * Which board a toast is about, when there is more than one.
 *
 * On a board interface there is exactly one machine, so a toast saying
 * "node 2 powered off" is unambiguous and a prefix would be noise. In the
 * fleet the same shared control runs against eight machines and the same
 * sentence is useless: the operator cannot tell whether the node that powered
 * off is the one they meant.
 *
 * The fix belongs here rather than at the fifteen call sites in the tabs. Those
 * components are the board's own, shared verbatim with the board interface --
 * that sharing is the whole point of the fleet, and editing them to mention a
 * board would either break the board interface or force a prop through every
 * control that raises a toast.
 *
 * So the scope is ambient: `BoardScope` supplies it, `useToast` reads it, and
 * a component that raises a toast never knows the difference. Absent (the
 * board interface), nothing is prefixed.
 */
export const ToastScopeContext = createContext<string | null>(null);
