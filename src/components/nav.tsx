'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/permissions';

const NAV_ITEMS: { href: string; label: string; ownerOnly: boolean; showAlertBadge?: boolean }[] = [
  { href: '/dashboard', label: 'ภาพรวม', ownerOnly: false },
  { href: '/receive-lot', label: 'รับเข้าล็อต', ownerOnly: true },
  { href: '/stock-count', label: 'นับสต๊อก', ownerOnly: false },
  { href: '/price-compare', label: 'เทียบราคา', ownerOnly: true },
  { href: '/alerts', label: 'แจ้งเตือน', ownerOnly: false, showAlertBadge: true },
  { href: '/settings', label: 'ตั้งค่า', ownerOnly: true },
];

const MOBILE_PRIMARY = ['/dashboard', '/stock-count', '/alerts'];

export function DesktopNav({ viewRole, alertCount }: { viewRole: Role; alertCount: number }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.ownerOnly || viewRole === 'owner');

  return (
    <nav className="sticky top-[62px] z-30 bg-[var(--surface-page)] border-b border-[var(--line-hairline)] hidden sm:block">
      <div className="max-w-[var(--content-max)] mx-auto px-6 lg:px-16 py-3 flex gap-2 overflow-x-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="gg-capsule"
              style={{
                background: active ? 'var(--gg-black)' : 'var(--gg-white)',
                color: active ? 'var(--gg-pearl)' : 'var(--gg-black)',
                borderColor: active ? 'var(--gg-black)' : 'var(--gg-grey-200)',
              }}
            >
              {item.label}
              {item.showAlertBadge && alertCount > 0 && <span className="opacity-75">&nbsp;{alertCount}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomTabBar({ viewRole, alertCount }: { viewRole: Role; alertCount: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems = NAV_ITEMS.filter((i) => i.ownerOnly && viewRole === 'owner');

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-16 left-3 right-3 bg-white rounded-2xl border-2 border-[var(--gg-black)] p-2 flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="px-4 py-3 rounded-xl font-semibold text-[15px]"
                style={{ background: pathname.startsWith(item.href) ? 'var(--gg-orange-wash)' : 'transparent' }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-[var(--gg-white)] border-t-2 border-[var(--gg-black)]">
        <div className="flex">
          {MOBILE_PRIMARY.map((href) => {
            const item = NAV_ITEMS.find((i) => i.href === href)!;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] relative"
                style={{ color: active ? 'var(--gg-orange)' : 'var(--gg-grey-500)' }}
              >
                <span className="text-[12px] font-semibold">{item.label}</span>
                {item.showAlertBadge && alertCount > 0 && (
                  <span className="absolute top-1 right-1/4 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--gg-orange)] text-white text-[9px] font-bold flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px]"
              style={{ color: moreOpen ? 'var(--gg-orange)' : 'var(--gg-grey-500)' }}
            >
              <span className="text-[12px] font-semibold">เพิ่มเติม</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
