'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateLotAction, type SaveLotState } from '@/lib/actions/lots';
import { useToast } from '@/components/toast';
import type { PriceCompareView } from '@/lib/queries';

type Row = PriceCompareView['tableRows'][number];

export function LotTable({ rows, supplierNames }: { rows: Row[]; supplierNames: string[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="gg-panel mb-5 overflow-x-auto">
      <table className="w-full text-[13px] min-w-[560px]">
        <thead>
          <tr className="text-left text-[var(--text-muted)] border-b border-[var(--line-hairline)]">
            <th className="py-2 font-medium">วันที่ซื้อ</th>
            <th className="py-2 font-medium">ซัพพลายเออร์</th>
            <th className="py-2 font-medium">จำนวน</th>
            <th className="py-2 font-medium text-right">ราคา/หน่วยขาย</th>
            <th className="py-2 font-medium text-right">ราคา/ยูนิตยา</th>
            <th className="py-2 font-medium text-right">หมดอายุ</th>
            <th className="py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            editingId === row.id ? (
              <LotEditRow key={row.id} row={row} supplierNames={supplierNames} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={row.id} style={{ background: row.rowBg }} className="border-b border-[var(--line-hairline)] last:border-0">
                <td className="py-2.5">{row.dateText}</td>
                <td className="py-2.5">{row.supplier}</td>
                <td className="py-2.5">{row.qtyText}</td>
                <td className="py-2.5 text-right">{row.priceText}</td>
                <td className="py-2.5 text-right font-semibold" style={{ color: row.perUnitColor }}>
                  {row.perUnitText} {row.tag}
                </td>
                <td className="py-2.5 text-right">{row.expiryText}</td>
                <td className="py-2.5 text-right">
                  <button onClick={() => setEditingId(row.id)} className="gg-btn gg-btn-ghost !py-1.5 !px-3 !text-[12px] !min-h-[32px]">
                    แก้ไข
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function LotEditRow({ row, supplierNames, onDone }: { row: Row; supplierNames: string[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<SaveLotState, FormData>(updateLotAction, {});
  const { showToast } = useToast();

  useEffect(() => {
    if (state.success) {
      showToast(state.success);
      onDone();
    }
    if (state.error) showToast(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error]);

  return (
    <tr className="border-b border-[var(--line-hairline)]" style={{ background: 'var(--gg-pearl)' }}>
      <td colSpan={7} className="py-3 px-2">
        <form action={formAction} className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <input type="hidden" name="id" value={row.id} />
          <div>
            <label className="gg-label">วันที่ซื้อ</label>
            <input name="purchaseDate" type="date" defaultValue={row.raw.purchaseDate} className="gg-input !py-1.5" />
          </div>
          <div>
            <label className="gg-label">วันหมดอายุ</label>
            <input name="expiryDate" type="date" required defaultValue={row.raw.expiryDate} className="gg-input !py-1.5" />
          </div>
          <div>
            <label className="gg-label">จำนวน</label>
            <input name="qty" type="number" min={0} defaultValue={row.raw.qty} className="gg-input !py-1.5" />
          </div>
          <div>
            <label className="gg-label">ราคาต่อหน่วย (บาท)</label>
            <input name="price" type="number" min={0} step="0.01" defaultValue={row.raw.unitPrice} className="gg-input !py-1.5" />
          </div>
          <div>
            <label className="gg-label">ซัพพลายเออร์</label>
            <input name="supplier" list="lot-edit-suppliers" defaultValue={row.raw.supplierName} className="gg-input !py-1.5" />
            <datalist id="lot-edit-suppliers">
              {supplierNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-2 items-end">
            <button type="submit" disabled={pending} className="gg-btn gg-btn-primary !py-1.5 !px-3 !text-[12px] !min-h-[32px]">
              {pending ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
            <button type="button" onClick={onDone} className="gg-btn gg-btn-ghost !py-1.5 !px-3 !text-[12px] !min-h-[32px]">
              ยกเลิก
            </button>
          </div>
        </form>
        {row.discarded && <p className="text-[11px] text-[var(--text-muted)] mt-2">ล็อตนี้ถูกทิ้งแล้ว — แก้ไขได้เฉพาะราคา/วันที่ ไม่กระทบยอดคงเหลือ</p>}
      </td>
    </tr>
  );
}
