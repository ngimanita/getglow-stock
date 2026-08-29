'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveLotAction, type SaveLotState } from '@/lib/actions/lots';
import { useToast } from '@/components/toast';
import { formatNumber, formatBaht, daysBetween, parseLocalDate } from '@/lib/format';
import { unitWord, consumeWord } from '@/lib/metrics';
import type { getActiveProducts, ReceiveLotView } from '@/lib/queries';

type Product = Awaited<ReturnType<typeof getActiveProducts>>[number];

export function ReceiveLotForm({
  products,
  view,
  supplierNames,
}: {
  products: Product[];
  view: ReceiveLotView;
  supplierNames: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, formAction, pending] = useActionState<SaveLotState, FormData>(saveLotAction, {});

  const [unitsPer, setUnitsPer] = useState(view.product.unitsPer);
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [supplier, setSupplier] = useState('');

  useEffect(() => {
    if (state.success) {
      showToast(state.success);
      setQty(0);
      setPrice(0);
      setSupplier('');
    }
  }, [state.success, showToast]);

  const uw = unitWord(view.product.type);
  const cw = consumeWord(view.product.type);
  const effectiveUnitsPer = Math.max(1, unitsPer || 1);
  const perUnit = price / effectiveUnitsPer;
  const totalValue = qty * price;
  const totalUnits = qty * effectiveUnitsPer;
  const diff = view.cheapestEverPerUnit ? perUnit - view.cheapestEverPerUnit : 0;
  const shelfDays = useMemo(() => {
    if (!purchaseDate || !expiryDate) return null;
    return daysBetween(parseLocalDate(purchaseDate), parseLocalDate(expiryDate));
  }, [purchaseDate, expiryDate]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div className="gg-panel">
        <label className="gg-label" htmlFor="productId">
          สินค้า
        </label>
        <select
          id="productId"
          defaultValue={view.product.id}
          onChange={(e) => router.push(`/receive-lot?product=${e.target.value}`)}
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

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="gg-label" htmlFor="unitsPer">
                {cw} ต่อ 1 {uw}
              </label>
              <input
                id="unitsPer"
                name="unitsPer"
                type="number"
                inputMode="numeric"
                min={1}
                value={unitsPer}
                onChange={(e) => setUnitsPer(Number(e.target.value))}
                className="gg-input"
              />
            </div>
            <div>
              <label className="gg-label" htmlFor="qty">
                จำนวนที่ซื้อ ({uw})
              </label>
              <input
                id="qty"
                name="qty"
                type="number"
                inputMode="numeric"
                min={0}
                value={qty || ''}
                onChange={(e) => setQty(Number(e.target.value))}
                className="gg-input"
              />
            </div>
            <div>
              <label className="gg-label" htmlFor="price">
                ราคาต่อ 1 {uw} (บาท)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="gg-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="gg-label" htmlFor="purchaseDate">
                วันที่ซื้อ
              </label>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="gg-input"
              />
            </div>
            <div>
              <label className="gg-label" htmlFor="expiryDate">
                วันหมดอายุ
              </label>
              <input
                id="expiryDate"
                name="expiryDate"
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="gg-input"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="gg-label" htmlFor="supplier">
              ซัพพลายเออร์
            </label>
            <input
              id="supplier"
              name="supplier"
              list="gg-suppliers"
              placeholder="เช่น เมดิก้า ซัพพลาย"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="gg-input"
            />
            <datalist id="gg-suppliers">
              {supplierNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {state.error && <p className="text-[var(--gg-orange)] text-[13px] font-medium mb-3">{state.error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="gg-btn gg-btn-primary flex-1">
              {pending ? 'กำลังบันทึก…' : 'บันทึกล็อตนี้'}
            </button>
            <button
              type="button"
              onClick={() => {
                setQty(0);
                setPrice(0);
                setSupplier('');
              }}
              className="gg-btn gg-btn-ghost"
            >
              ล้างฟอร์ม
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        <div className="gg-panel-ink">
          <p className="gg-eyebrow mb-2" style={{ color: 'var(--gg-orange)' }}>
            ระบบคำนวณให้
          </p>
          <p className="font-extrabold text-[36px] sm:text-[40px] leading-none mb-1" style={{ fontFamily: 'var(--font-core)' }}>
            {formatNumber(perUnit, 2)} ฿ / {cw}
          </p>
          <p className="text-[13px] text-[var(--gg-grey-300)] mb-4">
            = ราคาต่อ 1 {uw} ÷ {cw}ต่อ 1 {uw}
          </p>
          <div className="border-t border-[var(--gg-grey-700)] pt-4 space-y-2.5 text-[14px]">
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">มูลค่าล็อตรวม</span>
              <span className="font-semibold">{formatBaht(totalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">ปริมาณที่ได้รวม</span>
              <span className="font-semibold">
                {formatNumber(totalUnits)} {cw}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">เทียบราคาต่ำสุดที่เคยซื้อ</span>
              <span className="font-semibold" style={{ color: !view.cheapestEverPerUnit ? undefined : diff <= 0 ? '#8BE0B4' : 'var(--gg-orange)' }}>
                {!view.cheapestEverPerUnit
                  ? 'ยังไม่มีประวัติ'
                  : diff <= 0
                    ? `ถูกกว่าเดิม ${formatBaht(Math.abs(diff), 2)}`
                    : `แพงกว่า ${formatBaht(diff, 2)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gg-grey-300)]">อายุยาคงเหลือเมื่อรับเข้า</span>
              <span className="font-semibold">
                {shelfDays === null ? '—' : shelfDays > 0 ? `${formatNumber(Math.round(shelfDays / 30.4))} เดือน (${shelfDays} วัน)` : 'ตรวจวันหมดอายุอีกครั้ง'}
              </span>
            </div>
          </div>
        </div>

        <div className="gg-panel">
          <p className="font-bold text-[16px] mb-3">ล็อตล่าสุด 4 ครั้งของสินค้านี้</p>
          {view.recentLots.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">ยังไม่มีประวัติการซื้อ</p>
          ) : (
            <ul className="divide-y divide-[var(--line-hairline)]">
              {view.recentLots.map((l, i) => (
                <li key={i} className="py-2.5 flex items-start justify-between gap-3 text-[13px]">
                  <div>
                    <p className="font-medium">
                      {l.dateText} · {l.supplier}
                    </p>
                    <p className="text-[var(--text-muted)]">
                      {l.qtyText} · หมดอายุ {l.expiryText}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{l.perUnitText}</p>
                    <p className="text-[var(--text-muted)]">{l.priceText}</p>
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
