import { getSession } from '@/lib/auth';
import { getViewRole } from '@/lib/actions/view';
import { getDashboard, today } from '@/lib/queries';
import { ScreenHeader } from '@/components/screen-header';

const STAT_STYLE: Record<string, { bg: string; border: string; label: string; value: string }> = {
  urgent: { bg: 'var(--gg-orange)', border: 'var(--gg-orange)', label: 'rgba(255,255,255,.75)', value: 'var(--gg-white)' },
  soon: { bg: 'var(--gg-white)', border: '#C98A17', label: 'var(--text-muted)', value: '#C98A17' },
  expiry: { bg: 'var(--gg-white)', border: 'var(--gg-grey-100)', label: 'var(--text-muted)', value: 'var(--gg-black)' },
  value: { bg: 'var(--gg-black)', border: 'var(--gg-black)', label: 'var(--gg-orange)', value: 'var(--gg-pearl)' },
};

export default async function DashboardPage() {
  const session = await getSession();
  const viewRole = await getViewRole(session!.role);
  const { rows, stats } = await getDashboard(viewRole);
  const t = today();

  return (
    <div>
      <ScreenHeader
        kicker="Today at a glance"
        title="ภาพรวมสต๊อกยาฉีด"
        sub="เรียงตัวที่ใกล้หมดไว้บนสุด — ดูสีก็รู้ว่าต้องสั่งอะไรก่อน"
        today={t}
      />

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {stats.map((s) => {
          const style = STAT_STYLE[s.variant];
          return (
            <div
              key={s.kicker}
              className="rounded-2xl border-2 p-4"
              style={{ background: style.bg, borderColor: style.border }}
            >
              <p className="gg-eyebrow mb-1" style={{ color: style.label }}>
                {s.kicker}
              </p>
              <p className="font-extrabold text-[28px] sm:text-[30px] leading-none mb-1.5" style={{ color: style.value, fontFamily: 'var(--font-core)' }}>
                {s.big}
              </p>
              <p className="text-[12px] sm:text-[13px] truncate" style={{ color: style.label }}>
                {s.note}
              </p>
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-[var(--text-muted)]">ยังไม่มีสินค้าในระบบ — ไปเพิ่มที่หน้าตั้งค่าได้เลย</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {rows.map((r) => (
            <div key={r.id} className="gg-card" style={{ borderColor: r.borderColor }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-[17px] sm:text-[18px] leading-tight">{r.name}</p>
                  <p className="text-[13px] text-[var(--text-muted)]">{r.meta}</p>
                </div>
                <span className="gg-badge shrink-0" style={{ background: r.statusColor }}>
                  {r.statusLabel}
                </span>
              </div>

              <div className="flex divide-x divide-[var(--line-hairline)] mb-3">
                <div className="flex-1 pr-3">
                  <p className="text-[12px] text-[var(--text-muted)] mb-0.5">คงเหลือ</p>
                  <p className="font-extrabold text-[24px] sm:text-[26px] leading-none" style={{ fontFamily: 'var(--font-core)' }}>
                    {r.onHandText}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-1">{r.unitsText}</p>
                </div>
                <div className="flex-1 pl-3">
                  <p className="text-[12px] text-[var(--text-muted)] mb-0.5">อยู่ได้อีก</p>
                  <p className="font-extrabold text-[24px] sm:text-[26px] leading-none" style={{ color: r.statusColor, fontFamily: 'var(--font-core)' }}>
                    {r.daysLeftText}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-1">{r.usageText}</p>
                </div>
              </div>

              <div className="gg-progress mb-3">
                <span style={{ width: `${r.pct}%`, background: r.statusColor }} />
              </div>

              <dl className="text-[13px] sm:text-[14px] space-y-1.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">คาดว่าของจะหมด</dt>
                  <dd className="font-medium text-right">{r.depleteText}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">ควรเริ่มสั่งซื้อ</dt>
                  <dd className="font-bold text-right" style={{ color: r.statusColor }}>
                    {r.reorderText}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-muted)]">ล็อตที่ต้องใช้ก่อน (FEFO)</dt>
                  <dd className="font-medium text-right">{r.fefoText}</dd>
                </div>
                {r.showCost && (
                  <div className="pt-2 mt-1 border-t border-dashed border-[var(--line-hairline)] flex justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">ทุนล่าสุด · มูลค่าคงคลัง</dt>
                    <dd className="font-medium text-right">{r.costText}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
