'use client';

import { useActionState, useState } from 'react';
import { loginAction, type LoginState } from '@/lib/actions/auth';

const ROLE_LABEL: Record<string, string> = { owner: 'หลังบ้าน', stock: 'หน้าบ้าน' };

export function LoginForm({ users }: { users: { displayName: string; role: string }[] }) {
  const [selected, setSelected] = useState(users[0]?.displayName ?? '');
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="displayName" value={selected} />

      <div className="flex flex-col gap-2 mb-6">
        {users.map((u) => {
          const isSelected = u.displayName === selected;
          return (
            <button
              type="button"
              key={u.displayName}
              onClick={() => setSelected(u.displayName)}
              className="flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left transition-colors"
              style={{
                background: isSelected ? 'var(--gg-orange)' : 'transparent',
                borderColor: isSelected ? 'var(--gg-orange)' : 'var(--gg-grey-700)',
                color: isSelected ? 'var(--gg-white)' : 'var(--gg-pearl)',
              }}
            >
              <span className="font-semibold text-[15px]">{u.displayName}</span>
              <span
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: isSelected ? 'rgba(255,255,255,.55)' : 'var(--gg-grey-700)',
                  color: isSelected ? 'var(--gg-white)' : 'var(--gg-grey-300)',
                }}
              >
                {ROLE_LABEL[u.role] ?? u.role}
              </span>
            </button>
          );
        })}
      </div>

      <label className="block text-[13px] font-semibold text-[var(--gg-grey-300)] mb-2" htmlFor="pin">
        PIN
      </label>
      <input
        id="pin"
        name="pin"
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoComplete="off"
        placeholder="••••"
        required
        className="w-full text-center text-[24px] font-bold tracking-[0.4em] rounded-2xl px-4 py-3.5 mb-3 outline-none"
        style={{ background: 'var(--gg-pebble)', color: 'var(--gg-pearl)', border: '2px solid transparent' }}
      />

      {state.error && <p className="text-[var(--gg-orange)] text-[13px] font-medium mb-3">{state.error}</p>}

      <button type="submit" disabled={pending || !selected} className="gg-btn gg-btn-primary w-full mt-3">
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
