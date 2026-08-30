import { getSettingsPageData, getSupplierNames, getUsersList, getCategoryNames, today } from '@/lib/queries';
import { ScreenHeader } from '@/components/screen-header';
import {
  ThresholdForm,
  AddProductForm,
  ProductTable,
  AddSupplierForm,
  AddUserForm,
  UserTable,
  ExportButtons,
} from './settings-client';

export default async function SettingsPage() {
  const [{ settings, threshold, products }, supplierNames, users, categoryNames] = await Promise.all([
    getSettingsPageData(),
    getSupplierNames(),
    getUsersList(),
    getCategoryNames(),
  ]);

  return (
    <div>
      <ScreenHeader
        kicker="Settings"
        title="ตั้งค่าและรายการสินค้า"
        sub="ปรับ lead time, safety stock, วันแจ้งเตือนหมดอายุ และเพิ่มสินค้าใหม่ได้เอง"
        today={today()}
      />

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="gg-panel">
          <p className="font-bold text-[16px] mb-4">พารามิเตอร์</p>
          <ThresholdForm settings={settings} threshold={threshold} />
          <div className="mt-5 pt-5 border-t border-[var(--line-hairline)]">
            <p className="font-bold text-[15px] mb-3">ส่งออกข้อมูล</p>
            <ExportButtons />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="gg-panel">
            <p className="font-bold text-[16px] mb-4">เพิ่มสินค้าใหม่</p>
            <AddProductForm categoryNames={categoryNames} />
          </div>
          <div className="gg-panel">
            <p className="font-bold text-[16px] mb-4">เพิ่มซัพพลายเออร์</p>
            <AddSupplierForm />
            {supplierNames.length > 0 && (
              <p className="text-[13px] text-[var(--text-muted)] mt-3">{supplierNames.join(' · ')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="gg-panel mb-6">
        <p className="font-bold text-[16px] mb-4">รายการสินค้า ({products.length})</p>
        <ProductTable products={products} />
      </div>

      <div className="gg-panel">
        <p className="font-bold text-[16px] mb-4">ผู้ใช้งาน</p>
        <AddUserForm />
        <div className="mt-4">
          <UserTable users={users.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role, active: u.active }))} />
        </div>
      </div>
    </div>
  );
}
