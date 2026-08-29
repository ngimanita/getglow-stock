import { getSession } from '@/lib/auth';
import { getViewRole } from '@/lib/actions/view';
import { getAlerts, getSettings, today } from '@/lib/queries';
import { ScreenHeader } from '@/components/screen-header';
import { DiscardLotButton } from '@/components/discard-lot-button';

export default async function AlertsPage() {
  const session = await getSession();
  const viewRole = await getViewRole(session!.role);
  const [{ reorderAlerts, expiryAlerts, missingExpiry, discarded, discardNote }, settings] = await Promise.all([
    getAlerts(viewRole),
    getSettings(),
  ]);

  return (
    <div>
      <ScreenHeader
        kicker="Alerts"
        title="แจ้งเตือน"
        sub="ถึงจุดสั่งซื้อ และล็อตใกล้หมดอายุตามหลัก FEFO — ล็อตที่หมดอายุก่อน หยิบใช้ก่อน"
        today={today()}
      />

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-[18px]">ถึงจุดสั่งซื้อ</h2>
          <span className="gg-badge" style={{ background: 'var(--gg-orange)' }}>
            {reorderAlerts.length}
          </span>
        </div>
        {reorderAlerts.length === 0 ? (
          <p className="text-[14px] text-[var(--text-muted)]">ยังไม่มีสินค้าที่ต้องสั่งซื้อตอนนี้</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {reorderAlerts.map((a, i) => (
              <div key={i} className="rounded-2xl border-2 p-4 flex items-center justify-between gap-3" style={{ borderColor: a.color }}>
                <div className="min-w-0">
                  <p className="font-bold text-[15px] mb-0.5">{a.name}</p>
                  <p className="text-[13px] text-[var(--text-muted)]">{a.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-[var(--text-muted)]">แนะนำสั่ง</p>
                  <p className="font-bold text-[15px]" style={{ color: a.color }}>
                    {a.suggest}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-[18px]">ล็อตใกล้หมดอายุ · FEFO</h2>
          <span className="gg-badge" style={{ background: 'var(--gg-black)' }}>
            {expiryAlerts.length}
          </span>
        </div>
        <p className="text-[13px] text-[var(--text-muted)] mb-4">
          เตือนล่วงหน้า {settings.expiryWarnDays} วัน · ล็อตที่หมดอายุก่อนต้องหยิบใช้ก่อน
        </p>
        {expiryAlerts.length === 0 ? (
          <p className="text-[14px] text-[var(--text-muted)]">ไม่มีล็อตใกล้หมดอายุ</p>
        ) : (
          <div className="flex flex-col gap-2">
            {expiryAlerts.map((a) => (
              <div key={a.lotId} className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: a.bg }}>
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                  style={{ background: a.color, color: 'white' }}
                >
                  {a.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px]">{a.name}</p>
                  <p className="text-[12px] text-[var(--text-muted)]">{a.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[14px]" style={{ color: a.color }}>
                    {a.daysText}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">{a.expiryText}</p>
                </div>
                {a.canDiscard && <DiscardLotButton lotId={a.lotId} />}
              </div>
            ))}
          </div>
        )}

        {missingExpiry.length > 0 && (
          <div className="mt-4 rounded-2xl p-3.5" style={{ background: 'var(--gg-grey-50)' }}>
            <p className="font-semibold text-[13px] mb-2">ล็อตที่ยังไม่ระบุวันหมดอายุ — กรอกเพิ่มเพื่อให้ระบบเตือนได้</p>
            <ul className="space-y-1.5 text-[13px] text-[var(--text-muted)]">
              {missingExpiry.map((m) => (
                <li key={m.lotId}>
                  {m.name} — {m.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-3xl p-5 sm:p-6" style={{ background: 'var(--gg-pebble)', color: 'var(--gg-pearl)' }}>
        <p className="font-bold text-[16px] mb-1">ล็อตที่ทิ้งแล้ว (ของเสีย)</p>
        <p className="text-[13px] opacity-80 mb-4">{discardNote}</p>
        {discarded.length > 0 && (
          <ul className="divide-y divide-white/10">
            {discarded.map((d, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="opacity-70">หมดอายุ {d.expiryText}</p>
                </div>
                <p className="font-semibold">{d.lossText}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
