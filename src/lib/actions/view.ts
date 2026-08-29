'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Cosmetic-only cookie: lets the owner preview the stock-staff experience
// (hides cost/value figures, trims the nav). It never grants or revokes
// permission — every mutation and every owner-only route still checks the
// real session role, not this cookie.
const VIEW_COOKIE = 'gg_view_role';

export async function setViewRoleAction(role: 'owner' | 'stock') {
  const jar = await cookies();
  jar.set(VIEW_COOKIE, role, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  revalidatePath('/', 'layout');
}

export async function getViewRole(actualRole: 'owner' | 'stock'): Promise<'owner' | 'stock'> {
  if (actualRole !== 'owner') return 'stock'; // stock staff never get a preview toggle
  const jar = await cookies();
  const v = jar.get(VIEW_COOKIE)?.value;
  return v === 'stock' ? 'stock' : 'owner';
}
