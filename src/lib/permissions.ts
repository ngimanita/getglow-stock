// Server-side role gates (rule from the README: "Enforce permissions
// server-side, not only by hiding nav"). Every mutation and every page must
// call these — the nav/UI hiding is a UX nicety on top, never the boundary.

import type { SessionPayload } from './auth';

export type Role = 'owner' | 'stock';

export const SCREENS = ['dash', 'buy', 'count', 'price', 'alerts', 'settings'] as const;
export type Screen = (typeof SCREENS)[number];

const OWNER_ONLY_SCREENS: Screen[] = ['buy', 'price', 'settings'];

export function screensFor(role: Role): Screen[] {
  return role === 'owner' ? [...SCREENS] : SCREENS.filter((s) => !OWNER_ONLY_SCREENS.includes(s));
}

export function canAccessScreen(role: Role, screen: Screen): boolean {
  return screensFor(role).includes(screen);
}

export function requireOwner(session: SessionPayload | null): asserts session is SessionPayload {
  if (!session || session.role !== 'owner') {
    throw new Error('FORBIDDEN: owner role required');
  }
}

export function requireSession(session: SessionPayload | null): asserts session is SessionPayload {
  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }
}

/** Can this role discard an expired lot? Rule: both owner and stock can (README role table). */
export function canDiscardLot(role: Role): boolean {
  return role === 'owner' || role === 'stock';
}

/** Can this role save a stock count? Both can. */
export function canSaveCount(role: Role): boolean {
  return role === 'owner' || role === 'stock';
}

/** Whether waste-log baht loss should be hidden ("ซ่อนทุน") for this role. */
export function hidesCost(role: Role): boolean {
  return role === 'stock';
}
