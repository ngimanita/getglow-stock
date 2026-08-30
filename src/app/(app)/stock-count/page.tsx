import { prisma } from '@/lib/db';
import { getActiveProducts, getStockCountView, getStaffNames, getSettings, today } from '@/lib/queries';
import { isMachine } from '@/lib/metrics';
import { ScreenHeader } from '@/components/screen-header';
import { StockCountForm } from './stock-count-form';

export default async function StockCountPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productParam } = await searchParams;
  const products = await getActiveProducts();
  const productId = productParam && products.some((p) => p.id === productParam) ? productParam : products[0]?.id;
  const [view, staffNames, settings] = await Promise.all([
    productId ? getStockCountView(productId) : Promise.resolve(null),
    getStaffNames(),
    getSettings(),
  ]);

  let receivedQtySumToday = 0;
  if (view) {
    const isM = isMachine(view.product);
    const lotsInWindow = await prisma.lot.findMany({
      where: { productId: view.product.id, purchaseDate: { gt: view.prevCountedAt, lte: today() } },
    });
    receivedQtySumToday = lotsInWindow.reduce((sum, l) => sum + l.qty * (isM ? view.product.unitsPer : 1), 0);
  }

  return (
    <div>
      <ScreenHeader
        kicker="Stock count"
        title="อัปเดตสต๊อกคงเหลือ"
        sub="นับได้เท่าไหร่กรอกไปเลย ระบบคำนวณอัตราการใช้และวันที่ควรเริ่มสั่งซื้อรอบถัดไปให้"
        today={today()}
      />
      {!view ? (
        <p className="text-[var(--text-muted)]">ยังไม่มีสินค้าในระบบ</p>
      ) : (
        <StockCountForm
          products={products}
          view={view}
          staffNames={staffNames}
          settings={settings}
          receivedQtySumToday={receivedQtySumToday}
        />
      )}
    </div>
  );
}
