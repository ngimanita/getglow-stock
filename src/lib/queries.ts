import { prisma } from './db';
import * as M from './metrics';
import { formatThaiDate, formatNumber, formatBaht, parseLocalDate } from './format';
import type { Role } from './permissions';

const fmtNum = (v: number, dp?: number) => formatNumber(v, dp);
const fmtDate = (d: Date) => formatThaiDate(d);

export async function getSettings() {
  const s = await prisma.setting.findFirst({ where: { id: 1 } });
  if (!s) throw new Error('Settings row missing — run `npm run db:seed`');
  return s;
}

/** "Today" as a local-midnight Date in Asia/Bangkok, regardless of server TZ. */
export function today(): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseLocalDate(iso);
}

const STATUS_COLOR: Record<M.ProductStatus, string> = {
  urgent: 'var(--gg-orange)',
  soon: '#C98A17',
  ok: '#2E7D5B',
};
const STATUS_BORDER: Record<M.ProductStatus, string> = {
  urgent: 'var(--gg-orange)',
  soon: '#C98A17',
  ok: 'var(--gg-grey-100)',
};
const STATUS_BG: Record<M.ProductStatus, string> = {
  urgent: 'var(--gg-orange-wash)',
  soon: 'rgba(201,138,23,.10)',
  ok: 'rgba(46,125,91,.08)',
};

// ---- dashboard --------------------------------------------------------

export interface StatCard {
  kicker: string;
  big: string;
  note: string;
  variant: 'urgent' | 'soon' | 'expiry' | 'value';
}

export interface DashboardRow {
  id: string;
  name: string;
  meta: string;
  statusLabel: string;
  statusColor: string;
  borderColor: string;
  bgColor: string;
  onHandText: string;
  unitsText: string;
  daysLeftText: string;
  usageText: string;
  pct: number;
  depleteText: string;
  reorderText: string;
  fefoText: string;
  showCost: boolean;
  costText: string;
}

export async function getDashboard(role: Role): Promise<{ rows: DashboardRow[]; stats: StatCard[] }> {
  const [products, lots, settings] = await Promise.all([
    prisma.product.findMany({ where: { archived: false } }),
    prisma.lot.findMany(),
    getSettings(),
  ]);
  const t = today();
  const withMetrics = products
    .map((p) => ({ p, m: M.computeMetrics(p, settings, t) }))
    .sort((a, b) => a.m.daysLeft - b.m.daysLeft);

  const urgent = withMetrics.filter((r) => r.m.status === 'urgent');
  const soon = withMetrics.filter((r) => r.m.status === 'soon');
  const expLots = M.expiringLots(lots, settings, t);

  const rows: DashboardRow[] = withMetrics.map(({ p, m }) => {
    const fefo = M.fefoNextLot(lots, p.id);
    const nonDiscarded = M.nonDiscardedLotsByPurchaseDate(lots, p.id);
    const lastLot = nonDiscarded[nonDiscarded.length - 1];
    const pu = lastLot ? M.perUnitPrice(lastLot, p) : 0;
    const uw = M.unitWord(p);
    const cw = M.consumeWord(p);
    const isM = M.isMachine(p);
    return {
      id: p.id,
      name: p.name,
      meta: p.category + ' · ' + (p.unitsPer > 1 ? fmtNum(p.unitsPer) + ' ' + cw + ' / ' + uw : '1 ' + uw),
      statusLabel: M.statusLabel(m.status),
      statusColor: STATUS_COLOR[m.status],
      borderColor: STATUS_BORDER[m.status],
      bgColor: STATUS_BG[m.status],
      onHandText: M.stockText(p, fmtNum),
      unitsText: isM
        ? '= ' + fmtNum(M.stockUnits(p)) + ' shot พร้อมยิง'
        : p.unitsPer > 1
          ? '= ' + fmtNum(p.onHand * p.unitsPer) + ' ยูนิต'
          : 'พร้อมใช้',
      daysLeftText: m.daysLeft + ' วัน',
      usageText: fmtNum(m.usage) + ' ' + M.countWord(p) + '/เดือน',
      pct: Math.max(3, Math.min(100, Math.round((m.daysLeft / 90) * 100))),
      depleteText: fmtDate(m.deplete),
      reorderText: M.reorderDateText(m.reorder, t, fmtDate),
      fefoText: fefo ? fmtDate(fefo.expiryDate) + ' (' + fmtNum(fefo.remaining) + ' ' + uw + ')' : '—',
      showCost: role === 'owner',
      costText: lastLot ? formatBaht(pu, 2) + '/' + cw + ' · ' + formatBaht(Math.round(p.onHand * lastLot.unitPrice)) : '—',
    };
  });

  const stats: StatCard[] = [
    {
      kicker: 'สั่งซื้อด่วน',
      big: String(urgent.length),
      note: urgent.length ? urgent.map((r) => r.p.name.split(' ')[0]).slice(0, 3).join(', ') : 'ไม่มีตัวไหนวิกฤต',
      variant: 'urgent',
    },
    { kicker: 'เตรียมสั่งซื้อ', big: String(soon.length), note: 'ภายใน 3-5 สัปดาห์', variant: 'soon' },
    { kicker: 'ล็อตใกล้หมดอายุ', big: String(expLots.length), note: `ภายใน ${settings.expiryWarnDays} วัน`, variant: 'expiry' },
  ];
  if (role === 'owner') {
    const invValue = M.inventoryValue(products, lots);
    stats.push({ kicker: 'มูลค่าสต๊อก', big: fmtNum(Math.round(invValue / 1000)) + 'K', note: 'ทุนยาคงคลังโดยประมาณ', variant: 'value' });
  }

  return { rows, stats };
}

export async function getActiveProducts() {
  return prisma.product.findMany({ where: { archived: false }, orderBy: { name: 'asc' } });
}

export async function getSupplierNames(): Promise<string[]> {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  return suppliers.map((s) => s.name);
}

export async function getStaffNames(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  return users.map((u) => u.displayName);
}

// ---- receive lot --------------------------------------------------------

export interface ReceiveLotView {
  product: Awaited<ReturnType<typeof getActiveProducts>>[number];
  recentLots: {
    dateText: string;
    supplier: string;
    qtyText: string;
    expiryText: string;
    perUnitText: string;
    priceText: string;
  }[];
  cheapestEverPerUnit: number | null;
}

export async function getReceiveLotView(productId: string): Promise<ReceiveLotView | null> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  const lots = M.nonDiscardedLotsByPurchaseDate(await prisma.lot.findMany({ where: { productId } }), productId);
  const recent = lots.slice(-4).reverse();
  const hist = lots.map((l) => M.perUnitPrice(l, product));
  return {
    product,
    recentLots: recent.map((l) => ({
      dateText: l.purchaseDate ? fmtDate(l.purchaseDate) : 'ไม่ระบุวันที่ซื้อ',
      supplier: l.supplierName,
      qtyText: fmtNum(l.qty) + ' ' + M.unitWord(product) + ' · เหลือ ' + fmtNum(l.remaining),
      expiryText: l.expiryDate ? fmtDate(l.expiryDate) : 'ไม่ระบุวันหมดอายุ',
      perUnitText: formatBaht(M.perUnitPrice(l, product), 2) + '/' + M.consumeWord(product),
      priceText: formatBaht(l.unitPrice) + '/' + M.unitWord(product),
    })),
    cheapestEverPerUnit: hist.length ? Math.min(...hist) : null,
  };
}

// ---- stock count ----------------------------------------------------------

export interface StockCountView {
  product: Awaited<ReturnType<typeof getActiveProducts>>[number];
  prevCountedAt: Date;
  prevQty: number;
  history: { dateText: string; qtyText: string; byText: string; rateText: string }[];
}

export async function getStockCountView(productId: string): Promise<StockCountView | null> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  const counts = await prisma.stockCount.findMany({ where: { productId }, orderBy: { countedAt: 'asc' } });
  const prev = counts[counts.length - 1];
  const cw = M.countWord(product);
  return {
    product,
    prevCountedAt: prev ? prev.countedAt : product.lastCountAt,
    prevQty: prev ? prev.qty : M.stockUnits(product),
    history: counts
      .slice()
      .reverse()
      .map((c) => ({
        dateText: fmtDate(c.countedAt),
        qtyText: fmtNum(c.qty) + ' ' + cw,
        byText: c.countedByName || 'ไม่ระบุผู้นับ',
        rateText: 'ใช้ ' + fmtNum(c.ratePerMonth) + '/เดือน',
      })),
  };
}

/** Preview of the reorder-date panel, computed live as the count form changes (server-computed, called via an API route or server action). */
export function previewStockCount(input: {
  product: M.ProductLike;
  settings: { leadTimeDays: number; safetyStockDays: number };
  prevCountedAt: Date;
  prevQty: number;
  newCountedAt: Date;
  receivedQtySum: number;
  headsCounted: number;
  openShotsCounted: number;
  t: Date;
}) {
  const isM = M.isMachine(input.product);
  const counted = M.resolveCountedQty({
    isMachine: isM,
    unitsPer: input.product.unitsPer,
    headsCounted: input.headsCounted,
    openShotsCounted: input.openShotsCounted,
  });
  const usageRate = M.computeUsageRate({
    storedUsagePerMonth: input.product.usagePerMonth,
    prevCountedAt: input.prevCountedAt,
    prevQty: input.prevQty,
    newCountedAt: input.newCountedAt,
    receivedQtySum: input.receivedQtySum,
    counted,
  });
  const perDay = usageRate.rate / 30;
  const daysLeft = Math.round(counted / perDay);
  const deplete = new Date(input.newCountedAt.getTime() + daysLeft * 86400000);
  const reorder = new Date(deplete.getTime() - (input.settings.leadTimeDays + input.settings.safetyStockDays) * 86400000);
  return { counted, usageRate, daysLeft, deplete, reorder };
}

// ---- price compare --------------------------------------------------------

export interface PriceCompareView {
  product: Awaited<ReturnType<typeof getActiveProducts>>[number];
  stats: M.PriceStats;
  bars: { heightPct: number; valueText: string; color: string; borderColor: string; dateText: string; supplier: string }[];
  tableRows: {
    dateText: string;
    supplier: string;
    qtyText: string;
    priceText: string;
    perUnitText: string;
    tag: string;
    perUnitColor: string;
    rowBg: string;
    expiryText: string;
  }[];
  supplierRows: { name: string; lotsText: string; valueText: string; deltaText: string; deltaColor: string }[];
}

export async function getPriceCompareView(productId: string): Promise<PriceCompareView | null> {
  const [product, allProducts] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.product.findMany({ where: { archived: false } }),
  ]);
  if (!product) return null;
  const allLots = await prisma.lot.findMany();
  const lots = allLots.filter((l) => l.productId === productId).sort((a, b) => (a.purchaseDate?.getTime() ?? 0) - (b.purchaseDate?.getTime() ?? 0));
  const stats = M.priceStatsForProduct(allLots, productId, product);
  const maxVal = Math.max(...lots.map((l) => M.perUnitPrice(l, product)), 1);

  const bars = lots.map((l) => {
    const v = M.perUnitPrice(l, product);
    const tag = M.tagLotPrice(v, stats);
    return {
      heightPct: Math.max(12, Math.round((v / (maxVal * 1.15)) * 100)),
      valueText: fmtNum(v, 2),
      color: tag === 'min' ? '#2E7D5B' : tag === 'above-average' ? 'var(--gg-orange)' : 'var(--gg-ivory)',
      borderColor: tag === 'min' ? '#2E7D5B' : tag === 'above-average' ? 'var(--gg-orange)' : 'var(--gg-black)',
      dateText: l.purchaseDate ? fmtDate(l.purchaseDate) : 'ไม่ระบุวันที่',
      supplier: l.supplierName,
    };
  });

  const tableRows = lots
    .slice()
    .reverse()
    .map((l) => {
      const v = M.perUnitPrice(l, product);
      const tag = M.tagLotPrice(v, stats);
      return {
        dateText: l.purchaseDate ? fmtDate(l.purchaseDate) : 'ไม่ระบุวันที่',
        supplier: l.supplierName,
        qtyText: fmtNum(l.qty) + ' ' + M.unitWord(product),
        priceText: formatBaht(l.unitPrice),
        perUnitText: formatBaht(v, 2),
        tag: tag === 'min' ? '★ ต่ำสุด' : tag === 'above-average' ? '▲' : '',
        perUnitColor: tag === 'min' ? '#2E7D5B' : tag === 'above-average' ? 'var(--gg-orange)' : 'var(--gg-black)',
        rowBg: tag === 'min' ? 'rgba(46,125,91,.07)' : 'transparent',
        expiryText: l.expiryDate ? fmtDate(l.expiryDate) : 'ไม่ระบุ',
      };
    });

  const productsById = new Map(allProducts.map((p) => [p.id, p]));
  const supplierRows = M.supplierComparison(allLots, productsById)
    .map((r) => ({
      name: r.supplierName,
      lotsText: r.lotCount + ' ล็อต',
      valueText: formatBaht(r.totalValue),
      deltaText: r.isCheapest ? 'ถูกที่สุด' : '+' + formatBaht(r.avgDelta, 2) + '/ยูนิต',
      deltaColor: r.isCheapest ? '#2E7D5B' : 'var(--gg-orange)',
    }))
    .sort((a, b) => a.deltaText.length - b.deltaText.length);

  return { product, stats, bars, tableRows, supplierRows };
}

// ---- alerts -----------------------------------------------------------

export interface ReorderAlert {
  name: string;
  color: string;
  detail: string;
  suggest: string;
}
export interface ExpiryAlert {
  rank: string;
  lotId: string;
  name: string;
  color: string;
  bg: string;
  detail: string;
  daysText: string;
  expiryText: string;
  canDiscard: boolean;
}
export interface DiscardedRow {
  label: string;
  expiryText: string;
  lossText: string;
}

export async function getAlerts(role: Role) {
  const [products, lots, settings] = await Promise.all([
    prisma.product.findMany({ where: { archived: false } }),
    prisma.lot.findMany(),
    getSettings(),
  ]);
  const t = today();
  const productsById = new Map(products.map((p) => [p.id, p]));
  const withMetrics = products.map((p) => ({ p, m: M.computeMetrics(p, settings, t) }));

  const reorderAlerts: ReorderAlert[] = withMetrics
    .filter((r) => r.m.status !== 'ok')
    .map(({ p, m }) => {
      const stock = M.stockUnits(p);
      const need = M.suggestedReorderQty(p, m.usage, stock);
      return {
        name: p.name,
        color: STATUS_COLOR[m.status],
        detail:
          'เหลือ ' +
          M.stockText(p, fmtNum) +
          ' · อยู่ได้ ' +
          m.daysLeft +
          ' วัน · จุดสั่งซื้อ ' +
          (M.reorderDateText(m.reorder, t, fmtDate) === 'สั่งเลยวันนี้' ? 'เลยมาแล้ว' : fmtDate(m.reorder)),
        suggest: fmtNum(need) + ' ' + M.unitWord(p),
      };
    });

  const expFlags = M.expiringLots(lots, settings, t);
  const expiryAlerts: ExpiryAlert[] = expFlags.map((x, i) => {
    const p = productsById.get(x.lot.productId);
    const over = x.daysUntilExpiry < 0;
    return {
      rank: over ? '!' : String(i + 1),
      lotId: x.lot.id,
      name: p?.name ?? '—',
      color: over ? 'var(--gg-black)' : x.daysUntilExpiry <= 30 ? 'var(--gg-orange)' : '#C98A17',
      bg: over ? 'var(--gg-grey-50)' : x.daysUntilExpiry <= 30 ? 'var(--gg-orange-wash)' : 'rgba(201,138,23,.08)',
      detail:
        'ล็อต ' +
        (x.lot.purchaseDate ? fmtDate(x.lot.purchaseDate) : 'ไม่ระบุวันที่') +
        ' · ' +
        x.lot.supplierName +
        ' · เหลือ ' +
        fmtNum(x.lot.remaining) +
        ' ' +
        (p ? M.unitWord(p) : 'ชิ้น'),
      daysText: over ? 'หมดอายุแล้ว ' + Math.abs(x.daysUntilExpiry) + ' วัน' : 'อีก ' + x.daysUntilExpiry + ' วัน',
      expiryText: fmtDate(x.lot.expiryDate),
      canDiscard: over,
    };
  });

  const missingExpiry = M.lotsMissingExpiry(lots).map((l) => ({
    lotId: l.id,
    name: productsById.get(l.productId)?.name ?? '—',
    detail: (l.purchaseDate ? fmtDate(l.purchaseDate) : 'ไม่ระบุวันที่ซื้อ') + ' · ' + l.supplierName + ' · เหลือ ' + fmtNum(l.remaining),
  }));

  const discardedLots = lots.filter((l) => l.discarded);
  const discarded: DiscardedRow[] = discardedLots.map((l) => {
    const p = productsById.get(l.productId);
    const qty = l.qtyDiscarded ?? l.remaining;
    return {
      label: (p?.name ?? '—') + ' · ' + fmtNum(qty) + ' ' + (p ? M.unitWord(p) : 'ชิ้น'),
      expiryText: l.expiryDate ? fmtDate(l.expiryDate) : 'ไม่ระบุ',
      lossText: role === 'owner' ? formatBaht(Math.round(qty * l.unitPrice)) : 'ซ่อนทุน',
    };
  });

  return {
    reorderAlerts,
    expiryAlerts,
    missingExpiry,
    discarded,
    discardNote: discarded.length
      ? 'ของเสียเกิดจากล็อตที่ไม่ได้หยิบใช้ตามลำดับ FEFO — เช็กหน้าแจ้งเตือนทุกสัปดาห์ช่วยลดตัวเลขนี้ได้'
      : 'ยังไม่มีล็อตที่ต้องทิ้ง — ดีมาก',
  };
}

export async function getAlertCount(): Promise<number> {
  const [products, lots, settings] = await Promise.all([
    prisma.product.findMany({ where: { archived: false } }),
    prisma.lot.findMany(),
    getSettings(),
  ]);
  const t = today();
  const nonOk = products.filter((p) => M.computeMetrics(p, settings, t).status !== 'ok').length;
  const exp = M.expiringLots(lots, settings, t).length;
  return nonOk + exp;
}

// ---- settings page ----------------------------------------------------

export async function getSettingsPageData() {
  const [settings, products] = await Promise.all([getSettings(), prisma.product.findMany({ orderBy: { name: 'asc' } })]);
  return {
    settings,
    threshold: M.threshold(settings),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unitText: (p.unitsPer > 1 ? fmtNum(p.unitsPer) + ' ' + M.consumeWord(p) + ' / ' : '') + M.unitWord(p),
      onHandText: M.stockText(p, fmtNum),
      usageText: fmtNum(p.usagePerMonth) + ' ' + M.countWord(p),
      archived: p.archived,
    })),
  };
}

/** Distinct categories already in use, for the Add Product form's autocomplete (same pattern as suppliers/staff). */
export async function getCategoryNames(): Promise<string[]> {
  const rows = await prisma.product.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } });
  return rows.map((r) => r.category);
}

export async function getUsersList() {
  return prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
}
