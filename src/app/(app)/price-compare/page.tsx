import Link from 'next/link';
import { getActiveProducts, getPriceCompareView, today } from '@/lib/queries';
import { ScreenHeader } from '@/components/screen-header';
import { consumeWord, isMachine } from '@/lib/metrics';

export default async function PriceComparePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productParam } = await searchParams;
  const products = await getActiveProducts();
  const productId = productParam && products.some((p) => p.id === productParam) ? productParam : products[0]?.id;
  const view = productId ? await getPriceCompareView(productId) : null;

  return (
    <div>
      <ScreenHeader
        kicker="Price history"
        title="เปรียบเทียบราคาต่อยูนิต"
        sub="ราคาย้อนหลังทุกล็อต ไฮไลต์ราคาต่ำสุดและเฉลี่ย ใช้ต่อรองตอนซัพพลายเออร์เสนอราคาใหม่"
        today={today()}
      />

      <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/price-compare?product=${p.id}`}
            className="gg-capsule shrink-0"
            style={{
              background: p.id === productId ? 'var(--gg-orange)' : 'var(--gg-white)',
              color: p.id === productId ? 'var(--gg-white)' : 'var(--gg-black)',
              borderColor: p.id === productId ? 'var(--gg-orange)' : 'var(--gg-grey-200)',
            }}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {!view ? (
        <p className="text-[var(--text-muted)]">ยังไม่มีสินค้าในระบบ</p>
      ) : (
        <>
          <div className="gg-panel mb-5">
            <p className="font-bold text-[18px] mb-1">{view.product.name}</p>
            <p className="text-[13px] text-[var(--text-muted)] mb-4">
              ราคาต่อ 1 {consumeWord(view.product.type)}
              {isMachine(view.product.type) ? ' (ราคาหัว ÷ shot ต่อหัว)' : 'ยา'} ย้อนหลังตามล็อตที่ซื้อ
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatBox label="ต่ำสุดที่เคยซื้อ" value={view.stats.min} color="#2E7D5B" />
              <StatBox label="เฉลี่ย" value={view.stats.average} color="var(--gg-black)" />
              <StatBox label="ล็อตล่าสุด" value={view.stats.latest} color={view.stats.latest > view.stats.average ? 'var(--gg-orange)' : '#2E7D5B'} />
            </div>

            {view.bars.length > 0 && (
              <div className="flex items-end gap-2 mb-2 overflow-x-auto pb-2" style={{ height: 210 }}>
                {view.bars.map((b, i) => (
                  <div key={i} className="flex flex-col items-center justify-end h-full shrink-0" style={{ minWidth: 60 }}>
                    <p className="text-[12px] font-semibold mb-1">{b.valueText}</p>
                    <div
                      style={{
                        width: '100%',
                        height: `${b.heightPct}%`,
                        background: b.color,
                        border: `2px solid ${b.borderColor}`,
                        borderBottom: 'none',
                        borderRadius: '8px 8px 0 0',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="border-t-2 border-black mb-2" />
            {view.bars.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {view.bars.map((b, i) => (
                  <div key={i} className="text-center shrink-0 text-[11px] text-[var(--text-muted)]" style={{ minWidth: 60 }}>
                    <p>{b.dateText}</p>
                    <p className="truncate">{b.supplier}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                </tr>
              </thead>
              <tbody>
                {view.tableRows.map((row, i) => (
                  <tr key={i} style={{ background: row.rowBg }} className="border-b border-[var(--line-hairline)] last:border-0">
                    <td className="py-2.5">{row.dateText}</td>
                    <td className="py-2.5">{row.supplier}</td>
                    <td className="py-2.5">{row.qtyText}</td>
                    <td className="py-2.5 text-right">{row.priceText}</td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: row.perUnitColor }}>
                      {row.perUnitText} {row.tag}
                    </td>
                    <td className="py-2.5 text-right">{row.expiryText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-3xl p-5 sm:p-6" style={{ background: 'var(--gg-ivory)' }}>
            <p className="font-bold text-[16px] mb-4">เทียบราคาซัพพลายเออร์ (ทุกสินค้า)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[480px]">
                <thead>
                  <tr className="text-left border-b border-black/10">
                    <th className="py-2 font-medium">ซัพพลายเออร์</th>
                    <th className="py-2 font-medium">จำนวนล็อต</th>
                    <th className="py-2 font-medium text-right">มูลค่ารวม</th>
                    <th className="py-2 font-medium text-right">เทียบราคา</th>
                  </tr>
                </thead>
                <tbody>
                  {view.supplierRows.map((s, i) => (
                    <tr key={i} className="border-b border-black/10 last:border-0">
                      <td className="py-2.5 font-medium">{s.name}</td>
                      <td className="py-2.5">{s.lotsText}</td>
                      <td className="py-2.5 text-right">{s.valueText}</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: s.deltaColor }}>
                        {s.deltaText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)] mb-1">{label}</p>
      <p className="font-bold text-[20px]" style={{ color }}>
        {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
      </p>
    </div>
  );
}
