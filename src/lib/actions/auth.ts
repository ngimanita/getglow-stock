'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { attemptLogin, createSessionToken, setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const displayName = String(formData.get('displayName') || '').trim();
  const pin = String(formData.get('pin') || '').trim();
  if (!displayName) return { error: 'เลือกชื่อก่อนนะ' };

  const result = await attemptLogin(displayName, pin);
  if (!result.ok) return { error: result.error };

  const token = await createSessionToken(result.payload);
  await setSessionCookie(token);
  await logAudit(result.payload, 'auth.login', `เข้าสู่ระบบ · มุมมอง${result.payload.role === 'owner' ? 'หลังบ้าน' : 'หน้าบ้าน'}`);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) await logAudit(session, 'auth.logout', 'ออกจากระบบ');
  await clearSessionCookie();
  redirect('/login');
}

export async function loginUsersList() {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { displayName: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  return users;
}
