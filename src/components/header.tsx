'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/lib/actions/auth';
import { setViewRoleAction } from '@/lib/actions/view';
import type { Role } from '@/lib/permissions';

const ROLE_LABEL: Record<Role, string> = { owner: 'หลังบ้าน', stock: 'หน้าบ้าน' };

export function Header({
  displayName,
  actualRole,
  viewRole,
}: {
  displayName: string;
  actualRole: Role;
  viewRole: Role;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-40 bg-black text-white">
      <div className="max-w-[var(--content-max)] mx-auto px-4 sm:px-6 lg:px-16 h-[62px] flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-extrabold text-[18px] text-[var(--gg-orange)] tracking-tight" style={{ fontFamily: 'var(--font-core)' }}>
            GETGLOW
          </span>
          <span className="font-semibold text-[10px] text-[var(--gg-pearl)] tracking-[0.18em] hidden xs:inline" style={{ fontFamily: 'var(--font-core)' }}>
            STOCK
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {actualRole === 'owner' && (
            <div className="hidden sm:flex items-center rounded-full border border-[var(--gg-grey-700)] p-0.5 text-[12px] font-semibold shrink-0">
              {(['stock', 'owner'] as const).map((r) => (
                <button
                  key={r}
                  disabled={pending}
                  onClick={() => startTransition(() => setViewRoleAction(r))}
                  className="px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    background: viewRole === r ? 'var(--gg-orange)' : 'transparent',
                    color: viewRole === r ? 'var(--gg-white)' : 'var(--gg-grey-300)',
                  }}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          )}
          <div className="text-right hidden sm:block min-w-0">
            <div className="text-[13px] font-semibold truncate max-w-[140px]">{displayName}</div>
            <div className="text-[11px] text-[var(--gg-grey-300)]">{ROLE_LABEL[actualRole]}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="gg-btn gg-btn-ghost !text-white !border-[var(--gg-grey-700)] !py-2 !px-3 !text-[13px] !min-h-[36px]">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
