'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCountAction, type SaveCountState } from '@/lib/actions/counts';
import { useToast } from '@/components/toast';
import { formatNumber, formatThaiDate, parseLocalDate, toISODate, addDays, daysBetween } from '@/lib/format';
import * as M from '@/lib/metrics';
import type { getActiveProducts, StockCountView, getSettings } from '@/lib/queries';

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];
type Settings = Awaited<ReturnType<typeof getSettings>>;

export function StockCountForm({
  products,
  view,
  staffNames,
  settings,
  receivedQtySumToday,
}: {
  products: Product[];
  view: StockCountView;
  staffNames: string[];
  settings: Settings;
  receivedQtySumToday: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction, pending] = useActionState<SaveCountState, FormData>(saveCountAction, {});

  const isM = M.isMachine(view.product.type);
  const cw = M.countWord(view.product.type);
  const uw = M.unitWord(view.product.type);
  const cPerHead = Math.max(1, view.product.unitsPer);

  const [countedDate, setCountedDate] = useState(toISODate(today()));
  const [headsCounted, setHeadsCounted] = useState(isM ? 0 : view.product.onHand);
  const [openShots, setOpenShots] = useState(view.product.openShots || 0);
  const [countedBy, setCountedBy] = useState('');

  useEffect(() => {
    if (state.success) {
      showToast(state.success);
      setCountedBy('');
    }
  }, [state.success, showToast]);

  const counted = M.resolveCountedQty({ isMachine: isM, unitsPer: view.product.unitsPer, headsCounted, openShotsCounted: openShots });
  const usage = M.computeUsageRate({
    storedUsagePerMonth: view.product.usagePerMonth,
    prevCountedAt: view.prevCountedAt,
    prevQty: view.prevQty,
    newCountedAt: parseLocalDate(countedDate),
    receivedQtySum: receivedQtySumToday,
    counted,
  });
  const dLeft = Math.round(counted / (usage.rate / 30));
  const deplete = addDays(parseLocalDate(countedDate), dLeft);
  const reorder = addDays(deplete, -(settings.leadTimeDays + settings.safetyStockDays));
  const t = today();
  const reorderText = daysBetween(t, reorder) <= 0 ? 'สั่งเลยวันนี้' : formatThaiDate(reorder);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div className="gg-panel">
        <label className="gg-label" htmlFor="productId">
          สินค้า
        </label>
        <select
          id="productId"
          defaultValue={view.product.id}
          onChange={(e) => router.push(`/stock-count?product=${e.target.value}`)}
          className="gg-input mb-4"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <form action={formAction}>
          <input type="hidden" name="productId" value={view.product.id} />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="gg-label" htmlFor="counted">
                {isM ? 'หัวที่ยังไม่เปิด (หัว)' : `นับได้จริง (${uw})`}
              </label>
              <input
                id="counted"
                name="counted"
                type="number"
                inputMode="numeric"
                min={0}
                value={headsCounted || ''}
                onChange={(e) => setHeadsCounted(Number(e.target.value))}
                className="gg-input !text-[22px] !font-bold !border-black"
              />
            </div>
            <div>
              <label className="gg-label" htmlFor="countedAt">
                วันที่นับ
              </label>
              <input
                id="countedAt"
                name="countedAt"
                type="date"
                value={countedDate}
                onChange={(e) => setCountedDate(e.target.value)}
                className="gg-input"
              />
            </div>
          </div>

          {isM && (
            <div className="mb-4 p-4 rounded-2xl border-2" style={{ borderColor: 'var(--gg-orange)', background: 'var(--gg-orange-wash)' }}>
              <label className="gg-label" htmlFor="openShots">
                หัวที่เปิดค้างอยู่ — เหลือกี่ shot
              </label>
              <input
                id="openShots"
                name="openShots"
                type="number"
                inputMode="numeric"
                min={0}
                max={cPerHead}
                value={openShots || ''}
                onChange={(e) => setOpenShots(Number(e.target.value))}
                className="gg-input mb-2"
              />
              <p className="text-[12px] text-[var(--text-muted)]">
                อ่านเลขจากหน้าจอเครื่อง · 1 หัว = {formatNumber(cPerHead)} shot · ไม่มีหัวเปิดค้างใส่ 0
              </p>
              <p className="text-[13px] font-semibold mt-2">รวมทั้งหมด {formatNumber(counted)} shot</p>
            </div>
          )}

          <div className="mb-4">
            <label className="gg-label" htmlFor="countedBy">
              คนนับสต๊อก
            </label>
            <input
              id="countedBy"
              name="countedBy"
              list="gg-staff"
              value={countedBy}
              onChange={(e) => setCountedBy(e.target.value)}
              className="gg-input"
            />
            <datalist id="gg-staff">
              {staffNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="text-[12px] text-[var(--text-muted)] mt-1.5">พิมพ์ชื่อใหม่ได้ ระบบจะจำไว้ให้เลือกครั้งหน้า</p>
          </div>

          <div className="rounded-2xl p-4 mb-5 text-[13px] space-y-1.5" style={{ background: 'var(--gg-pearl)' }}>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">นับครั้งก่อน</span>
              <span className="font-medium">
                {formatNumber(view.prevQty)} {cw} ({formatThaiDate(view.prevCountedAt)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">รับเข้าระหว่างนั้น</span>
              <span className="font-medium">
                {formatNumber(receivedQtySumToday)} {cw}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">ใช้ไปในช่วงนี้</span>
              <span className="font-medium">
                {formatNumber(usage.used)} {cw}
              </span>
            </div>
          </div>

          {state.error && <p className="text-[var(--gg-orange)] text-[13px] font-medium mb-3">{state.error}</p>}

          <button type="submit" disabled={pending} className="gg-btn gg-btn-primary w-full">
            {pending ? 'กำลังบันทึก…' : 'บันทึกยอดนับ'}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        <div className="gg-panel-ink">
          <p className="gg-eyebrow mb-1.5" style={{ color: 'var(--gg-orange)' }}>
            วันที่ควรเริ่มสั่งซื้อรอบถัดไป
          </p>
          <p className="font-extrabold text-[30px] leading-none mb-4" style={{ fontFamily: 'var(--font-core)' }}>
            {reorderText}
          </p>
          <div className="border-t border-[var(--gg-grey-700)] pt-4 space-y-3 text-[14px]">
            <div className="flex justify-between items-start">
              <span className="text-[var(--gg-grey-300)]">อัตราการใช้ต่อเดือน</span>
              <div className="text-right">
                <p className="font-semibold">
                  {formatNumber(usage.rate)} {cw}/เดือน
                </p>
                <p className="text-[11px] text-[var(--gg-grey-300)] max-w-[220px]">{usage.note}</p>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">สต๊อกอยู่ได้อีก</span>
              <span className="font-semibold">{dLeft} วัน</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">คาดว่าของจะหมด</span>
              <span className="font-semibold">{formatThaiDate(deplete)}</span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl px-3.5 py-3 text-[13px]" style={{ background: 'var(--gg-pebble)', color: 'var(--gg-grey-300)' }}>
            สูตร: วันที่ของจะหมด − lead time {settings.leadTimeDays} วัน − safety stock {settings.safetyStockDays} วัน
          </div>
        </div>

        <div className="gg-panel">
          <p className="font-bold text-[16px] mb-3">ประวัติการนับ</p>
          {view.history.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">ยังไม่มีประวัติการนับ</p>
          ) : (
            <ul className="divide-y divide-[var(--line-hairline)]">
              {view.history.map((h, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                  <div>
                    <p className="font-medium">{h.dateText}</p>
                    <p className="text-[var(--text-muted)]">นับโดย {h.byText}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{h.qtyText}</p>
                    <p className="text-[var(--text-muted)]">{h.rateText}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
