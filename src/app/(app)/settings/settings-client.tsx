'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  updateSettingsAction,
  addProductAction,
  addSupplierAction,
  addUserAction,
  resetPinAction,
  setProductArchivedAction,
  setUserActiveAction,
  type ActionState,
} from '@/lib/actions/settings';
import { useToast } from '@/components/toast';

const CATEGORY_PRESETS = ['โบท็อกซ์', 'ฟิลเลอร์', 'เมโส', 'หัวเครื่องยกกระชับ', 'ยากิน', 'ยาทา', 'อุปกรณ์ใช้แล้วทิ้ง', 'อื่น ๆ'];
const UNIT_WORD_PRESETS = ['ขวด', 'กล่อง', 'หัว', 'หลอด', 'แผง', 'ชิ้น'];

function useToastOnResult(state: ActionState) {
  const { showToast } = useToast();
  useEffect(() => {
    if (state.success) showToast(state.success);
    if (state.error) showToast(state.error);
  }, [state.success, state.error, showToast]);
}

export function ThresholdForm({
  settings,
  threshold,
}: {
  settings: { leadTimeDays: number; safetyStockDays: number; expiryWarnDays: number };
  threshold: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  useToastOnResult(state);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="gg-label" htmlFor="leadTimeDays">
          Lead time — รอของกี่วัน
        </label>
        <input id="leadTimeDays" name="leadTimeDays" type="number" min={0} defaultValue={settings.leadTimeDays} className="gg-input !text-[18px] !font-bold" />
      </div>
      <div>
        <label className="gg-label" htmlFor="safetyStockDays">
          Safety stock — สำรองกี่วัน
        </label>
        <input id="safetyStockDays" name="safetyStockDays" type="number" min={0} defaultValue={settings.safetyStockDays} className="gg-input !text-[18px] !font-bold" />
      </div>
      <div>
        <label className="gg-label" htmlFor="expiryWarnDays">
          แจ้งเตือนก่อนหมดอายุ (วัน)
        </label>
        <input id="expiryWarnDays" name="expiryWarnDays" type="number" min={1} defaultValue={settings.expiryWarnDays} className="gg-input !text-[18px] !font-bold" />
      </div>
      <p className="rounded-2xl p-3.5 text-[13px]" style={{ background: 'var(--gg-pearl)' }}>
        สินค้าจะขึ้นสถานะ สั่งซื้อด่วน เมื่อสต๊อกเหลือน้อยกว่า {threshold} วัน
      </p>
      <button type="submit" disabled={pending} className="gg-btn gg-btn-ink w-full">
        {pending ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
      </button>
    </form>
  );
}

export function ExportButtons() {
  return (
    <div className="flex flex-col gap-2">
      <a href="/api/export/stock" className="gg-btn gg-btn-ghost w-full">
        ดาวน์โหลดรายงานสต๊อก (CSV)
      </a>
      <a href="/api/export/lots" className="gg-btn gg-btn-ghost w-full">
        ดาวน์โหลดประวัติราคาต่อล็อต (CSV)
      </a>
    </div>
  );
}

export function AddProductForm({ categoryNames }: { categoryNames: string[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addProductAction, {});
  const { showToast } = useToast();
  useEffect(() => {
    if (state.success) showToast(state.success);
    if (state.error) showToast(state.error);
  }, [state.success, state.error, showToast]);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="gg-label" htmlFor="np-name">
          ชื่อสินค้า
        </label>
        <input id="np-name" name="name" required className="gg-input" placeholder="เช่น Neuronox 200U" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="gg-label" htmlFor="np-category">
            ประเภท
          </label>
          <input id="np-category" name="category" list="np-category-list" placeholder="เช่น โบท็อกซ์, เมโส, ยากิน" className="gg-input" />
          <datalist id="np-category-list">
            {Array.from(new Set([...CATEGORY_PRESETS, ...categoryNames])).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="gg-label" htmlFor="np-unitWord">
            หน่วยนับ
          </label>
          <input id="np-unitWord" name="unitWord" list="np-unit-list" placeholder="เช่น ขวด, กล่อง, หลอด, แผง" className="gg-input" />
          <datalist id="np-unit-list">
            {UNIT_WORD_PRESETS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="gg-label" htmlFor="np-unitsPer">
            ยูนิต/shot ต่อ 1 หน่วย
          </label>
          <input id="np-unitsPer" name="unitsPer" type="number" min={1} defaultValue={1} className="gg-input" />
        </div>
        <div>
          <label className="gg-label" htmlFor="np-usage">
            ใช้ต่อเดือน (ประมาณการเริ่มต้น)
          </label>
          <input id="np-usage" name="usagePerMonth" type="number" min={0.1} step={0.1} defaultValue={1} className="gg-input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[14px] font-medium cursor-pointer">
        <input type="checkbox" name="isMachine" className="w-4 h-4" />
        เป็นเครื่อง (นับเป็น shot — เช่น หัวเครื่องยกกระชับ)
      </label>
      <button type="submit" disabled={pending} className="gg-btn gg-btn-primary w-full">
        {pending ? 'กำลังเพิ่ม…' : 'เพิ่มสินค้า'}
      </button>
    </form>
  );
}

export function ProductTable({
  products,
}: {
  products: { id: string; name: string; category: string; unitText: string; onHandText: string; usageText: string; archived: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] min-w-[600px]">
        <thead>
          <tr className="text-left text-[var(--text-muted)] border-b border-[var(--line-hairline)]">
            <th className="py-2 font-medium">สินค้า</th>
            <th className="py-2 font-medium">ประเภท</th>
            <th className="py-2 font-medium">หน่วย</th>
            <th className="py-2 font-medium">คงเหลือ</th>
            <th className="py-2 font-medium">ใช้/เดือน</th>
            <th className="py-2 font-medium text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-[var(--line-hairline)] last:border-0" style={{ opacity: p.archived ? 0.5 : 1 }}>
              <td className="py-2.5 font-medium">{p.name}</td>
              <td className="py-2.5 text-[var(--text-muted)]">{p.category}</td>
              <td className="py-2.5">{p.unitText}</td>
              <td className="py-2.5">{p.onHandText}</td>
              <td className="py-2.5">{p.usageText}</td>
              <td className="py-2.5 text-right">
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setProductArchivedAction(p.id, !p.archived);
                      if (r.success) showToast(r.success);
                    })
                  }
                  className="gg-btn gg-btn-ghost !py-1.5 !px-3 !text-[12px] !min-h-[32px]"
                >
                  {p.archived ? 'นำกลับมาใช้' : 'เก็บเข้าคลัง'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AddSupplierForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addSupplierAction, {});
  useToastOnResult(state);
  return (
    <form action={formAction} className="flex flex-col sm:flex-row gap-2">
      <input name="name" required placeholder="ชื่อซัพพลายเออร์" className="gg-input" />
      <input name="contact" placeholder="เบอร์ติดต่อ (ไม่บังคับ)" className="gg-input" />
      <button type="submit" disabled={pending} className="gg-btn gg-btn-ghost shrink-0">
        {pending ? 'กำลังเพิ่ม…' : 'เพิ่ม'}
      </button>
    </form>
  );
}

export function AddUserForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addUserAction, {});
  useToastOnResult(state);
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_140px_100px_auto]">
      <input name="displayName" required placeholder="ชื่อพนักงาน" className="gg-input" />
      <select name="role" className="gg-input">
        <option value="stock">คลังยา (หน้าบ้าน)</option>
        <option value="owner">เจ้าของ (หลังบ้าน)</option>
      </select>
      <input name="pin" required maxLength={4} inputMode="numeric" placeholder="PIN 4 หลัก" className="gg-input" />
      <button type="submit" disabled={pending} className="gg-btn gg-btn-primary">
        {pending ? '…' : 'เพิ่ม'}
      </button>
    </form>
  );
}

export function UserTable({ users }: { users: { id: string; displayName: string; role: string; active: boolean }[] }) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');

  return (
    <ul className="divide-y divide-[var(--line-hairline)]">
      {users.map((u) => (
        <li key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2" style={{ opacity: u.active ? 1 : 0.5 }}>
          <div>
            <p className="font-medium text-[14px]">{u.displayName}</p>
            <p className="text-[12px] text-[var(--text-muted)]">{u.role === 'owner' ? 'เจ้าของ (หลังบ้าน)' : 'คลังยา (หน้าบ้าน)'}</p>
          </div>
          <div className="flex items-center gap-2">
            {resetTarget === u.id ? (
              <form
                className="flex items-center gap-2"
                action={async (fd: FormData) => {
                  const r = await resetPinAction({}, fd);
                  if (r.success) {
                    showToast(r.success);
                    setResetTarget(null);
                    setPinValue('');
                  } else if (r.error) showToast(r.error);
                }}
              >
                <input type="hidden" name="userId" value={u.id} />
                <input
                  name="pin"
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="PIN ใหม่"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  className="gg-input !py-1.5 !w-24"
                />
                <button type="submit" className="gg-btn gg-btn-primary !py-1.5 !px-3 !text-[12px] !min-h-[32px]">
                  ยืนยัน
                </button>
              </form>
            ) : (
              <button onClick={() => setResetTarget(u.id)} className="gg-btn gg-btn-ghost !py-1.5 !px-3 !text-[12px] !min-h-[32px]">
                ตั้ง PIN ใหม่
              </button>
            )}
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setUserActiveAction(u.id, !u.active);
                  if (r.success) showToast(r.success);
                })
              }
              className="gg-btn gg-btn-ghost !py-1.5 !px-3 !text-[12px] !min-h-[32px]"
            >
              {u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
