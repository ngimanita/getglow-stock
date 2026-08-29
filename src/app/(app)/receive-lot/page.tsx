import { getActiveProducts, getReceiveLotView, getSupplierNames } from '@/lib/queries';
import { ScreenHeader } from '@/components/screen-header';
import { ReceiveLotForm } from './receive-lot-form';
import { today } from '@/lib/queries';

export default async function ReceiveLotPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productParam } = await searchParams;
  const products = await getActiveProducts();
  const productId = productParam && products.some((p) => p.id === productParam) ? productParam : products[0]?.id;
  const [view, supplierNames] = await Promise.all([
    productId ? getReceiveLotView(productId) : Promise.resolve(null),
    getSupplierNames(),
  ]);

  return (
    <div>
      <ScreenHeader
        kicker="New lot received"
        title="บันทึกการซื้อเข้าล็อตใหม่"
        sub="กรอกราคาที่ซื้อจริง ระบบเทียบราคาต่อยูนิตให้ทันที ขนาด 100U กับ 200U เทียบกันตรง ๆ ได้"
        today={today()}
      />
      {!view ? (
        <p className="text-[var(--text-muted)]">ยังไม่มีสินค้าในระบบ — ไปเพิ่มที่หน้าตั้งค่าก่อน</p>
      ) : (
        <ReceiveLotForm products={products} view={view} supplierNames={supplierNames} />
      )}
    </div>
  );
}
