// Core inventory business logic for GETGLOW Stock.
//
// This is a line-for-line TypeScript port of the logic class embedded in the
// design handoff prototype (`design/GETGLOW Stock.dc.html`), which the
// handoff README names as "the authoritative spec for every calculation."
// Every function here must stay numerically identical to that prototype —
// see the README section "Business logic" for the plain-English spec, and
// the .dc.html `metrics()` / `saveCount()` / etc. methods for the source.
//
// Pure functions only (rule: deterministic math belongs in a script/lib, not
// scattered through UI code or left to agent judgement at request time).

import { addDays, daysBetween } from './format';

export type ProductStatus = 'urgent' | 'soon' | 'ok';

export interface ProductLike {
  /** Free-text, user-typed (โบท็อกซ์, ฟิลเลอร์, เมโส, ยากิน, ...) — display/grouping only, never branches math. */
  category: string;
  /** Free-text sales-unit label (ขวด/กล่อง/ชิ้น/หลอด/แผง/...). */
  unitWord: string;
  /** The only field that changes calculation behavior: shot-tracked device vs plain countable unit. */
  isMachine: boolean;
  unitsPer: number;
  onHand: number;
  openShots: number;
  usagePerMonth: number;
  lastCountAt: Date;
}

export interface SettingsLike {
  leadTimeDays: number;
  safetyStockDays: number;
  expiryWarnDays: number;
}

export interface LotLike {
  id: string;
  productId: string;
  purchaseDate: Date | null;
  /** Nullable for back-filled historic records only — the receive-lot form always requires it. */
  expiryDate: Date | null;
  qty: number;
  unitPrice: number;
  supplierName: string;
  remaining: number;
  discarded: boolean;
  qtyDiscarded?: number | null;
}

export interface StockCountLike {
  id: string;
  productId: string;
  countedAt: Date;
  qty: number;
  ratePerMonth: number;
  countedByName: string;
}

// ---- unit vocabulary --------------------------------------------------

export function isMachine(p: Pick<ProductLike, 'isMachine'>): boolean {
  return p.isMachine;
}

/** Sales unit word — the unit staff physically count. Now a stored, user-typed field. */
export function unitWord(p: Pick<ProductLike, 'unitWord'>): string {
  return p.unitWord;
}

/** Drug unit word — what price-per-unit is expressed in. */
export function consumeWord(p: Pick<ProductLike, 'isMachine'>): string {
  return isMachine(p) ? 'shot' : 'ยูนิต';
}

/** The unit a stock count is entered in — same as sales unit, except machine uses shots. */
export function countWord(p: Pick<ProductLike, 'isMachine' | 'unitWord'>): string {
  return isMachine(p) ? 'shot' : unitWord(p);
}

// ---- rule #1: stock quantity & price per drug unit --------------------

/** Total quantity on hand in "countable" units (shots for machine, sales units otherwise). */
export function stockUnits(p: Pick<ProductLike, 'isMachine' | 'onHand' | 'openShots' | 'unitsPer'>): number {
  if (isMachine(p)) {
    return (Number(p.onHand) || 0) * Math.max(1, Number(p.unitsPer) || 1) + (Number(p.openShots) || 0);
  }
  return Number(p.onHand) || 0;
}

/** Human-readable on-hand text, e.g. "3 ขวด" or "2 หัว + 240 shot". */
export function stockText(
  p: Pick<ProductLike, 'isMachine' | 'onHand' | 'openShots' | 'unitWord'>,
  fmtNum: (v: number) => string,
): string {
  if (isMachine(p)) {
    return `${fmtNum(p.onHand)} หัว + ${fmtNum(p.openShots || 0)} shot`;
  }
  return `${fmtNum(p.onHand)} ${unitWord(p)}`;
}

/** Price per 1 drug unit for a lot — what the owner negotiates on. Rule #1. */
export function perUnitPrice(lot: Pick<LotLike, 'unitPrice'>, product: Pick<ProductLike, 'unitsPer'>): number {
  const up = product.unitsPer > 1 ? product.unitsPer : 1;
  return lot.unitPrice / up;
}

// ---- rules #4-7: depletion / reorder / status --------------------------

export function threshold(settings: SettingsLike): number {
  return settings.leadTimeDays + settings.safetyStockDays;
}

export interface ProductMetrics {
  usage: number;
  daysLeft: number;
  deplete: Date;
  reorder: Date;
  status: ProductStatus;
}

/**
 * Per-product depletion metrics, computed from the product's last known
 * on-hand + stored usage rate, extrapolated to today. Rules #4-7.
 */
export function computeMetrics(
  product: Pick<ProductLike, 'isMachine' | 'onHand' | 'openShots' | 'unitsPer' | 'usagePerMonth' | 'lastCountAt'>,
  settings: SettingsLike,
  today: Date,
): ProductMetrics {
  const usage = Math.max(0.1, Number(product.usagePerMonth) || 0.1);
  const perDay = usage / 30;
  const daysLeftRaw = Math.max(0, Math.round(stockUnits(product) / perDay));
  const elapsed = Math.max(0, daysBetween(product.lastCountAt, today));
  const deplete = addDays(today, Math.max(0, daysLeftRaw - elapsed));
  const reorder = addDays(deplete, -threshold(settings));
  const t = threshold(settings);
  const daysLeft = Math.max(0, daysBetween(today, deplete));
  const status: ProductStatus = daysLeft <= t ? 'urgent' : daysLeft <= t + 21 ? 'soon' : 'ok';
  return { usage, daysLeft, deplete, reorder, status };
}

export function statusLabel(status: ProductStatus): string {
  if (status === 'urgent') return 'สั่งซื้อด่วน';
  if (status === 'soon') return 'เตรียมสั่งซื้อ';
  return 'ปกติ';
}

/** "สั่งเลยวันนี้" when the reorder date has already arrived/passed. */
export function reorderDateText(reorder: Date, today: Date, fmtDate: (d: Date) => string): string {
  return daysBetween(today, reorder) <= 0 ? 'สั่งเลยวันนี้' : fmtDate(reorder);
}

// ---- rule #3: usage rate from a stock count -----------------------------

export interface UsageRateResult {
  counted: number;
  used: number;
  gap: number;
  windowRate: number;
  useWindow: boolean;
  /** Raw blended (or fallback) rate — NOT yet rounded/floored for saving. */
  rate: number;
  note: string;
}

const NOTE_BLENDED = 'คิดจากยอดนับรอบนี้ถ่วงกับอัตราเดิม';
const NOTE_NO_MOVEMENT = 'ยอดไม่ขยับตั้งแต่นับครั้งก่อน — ใช้อัตราเดิมที่บันทึกไว้';
const NOTE_SHORT_GAP = 'ช่วงนับสั้นกว่า 14 วัน — ใช้อัตราเดิมที่บันทึกไว้';

/** Clamp raw "open shots" input to [0, unitsPer] — matches the count-screen input handler. */
export function clampOpenShots(openShots: number, unitsPer: number): number {
  const perHead = Math.max(1, Number(unitsPer) || 1);
  return Math.min(perHead, Math.max(0, Number(openShots) || 0));
}

/**
 * Usage rate computed from a new stock count vs. the previous one. Rule #3 —
 * "the smart part, do not simplify." See README "Usage rate from a stock
 * count" for the plain-English version of this formula.
 */
export function computeUsageRate(input: {
  storedUsagePerMonth: number;
  prevCountedAt: Date;
  prevQty: number;
  newCountedAt: Date;
  /** Sum of lot.qty * (isMachine ? unitsPer : 1) for lots purchased in (prevCountedAt, newCountedAt]. */
  receivedQtySum: number;
  /** The count entered, already resolved to "counted units" (see resolveCountedQty). */
  counted: number;
}): UsageRateResult {
  const { storedUsagePerMonth, prevCountedAt, prevQty, newCountedAt, receivedQtySum, counted } = input;
  const gap = Math.max(1, daysBetween(prevCountedAt, newCountedAt));
  const used = Math.max(0, prevQty + receivedQtySum - counted);
  const stored = Math.max(0.1, Number(storedUsagePerMonth) || 0.1);
  const windowRate = (used / gap) * 30;
  const useWindow = gap >= 14 && used > 0;
  const rate = useWindow ? Math.max(0.1, (windowRate * gap + stored * 30) / (gap + 30)) : stored;
  const note = useWindow ? NOTE_BLENDED : used === 0 ? NOTE_NO_MOVEMENT : NOTE_SHORT_GAP;
  return { counted, used, gap, windowRate, useWindow, rate, note };
}

/** Resolve the "counted" total from raw count-form input. */
export function resolveCountedQty(input: {
  isMachine: boolean;
  unitsPer: number;
  headsCounted: number;
  openShotsCounted: number;
}): number {
  if (!input.isMachine) return Math.max(0, Number(input.headsCounted) || 0);
  const perHead = Math.max(1, Number(input.unitsPer) || 1);
  return Math.max(0, Number(input.headsCounted) || 0) * perHead + clampOpenShots(input.openShotsCounted, input.unitsPer);
}

/** Rate as actually persisted to Product.usagePerMonth / StockCount.ratePerMonth (rule #3 save step). */
export function roundUsageForSave(rate: number): number {
  return Math.max(0.2, Math.round(rate * 10) / 10);
}

// ---- rule #8: FEFO & expiry alerts --------------------------------------

export interface ExpiryFlag<L> {
  lot: L;
  daysUntilExpiry: number;
}

/** Non-discarded lots for a product, oldest purchase first (matches prototype's lotsOf). */
export function nonDiscardedLotsByPurchaseDate<L extends LotLike>(lots: L[], productId: string): L[] {
  return lots
    .filter((l) => l.productId === productId && !l.discarded)
    .sort((a, b) => (a.purchaseDate?.getTime() ?? 0) - (b.purchaseDate?.getTime() ?? 0));
}

/**
 * FEFO pick: the non-discarded lot with remaining > 0 and the earliest
 * expiry. Rule #8. Lots with an unknown expiry (back-filled historic
 * records missing the date) can't be ranked, so they're excluded — never
 * guessed into a false position in the pick order.
 */
export function fefoNextLot<L extends LotLike>(lots: L[], productId: string): (L & { expiryDate: Date }) | undefined {
  return lots
    .filter((l): l is L & { expiryDate: Date } => l.productId === productId && !l.discarded && l.remaining > 0 && l.expiryDate !== null)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())[0];
}

/**
 * Lots with an unknown expiry date, still in stock — surfaced separately so
 * staff are prompted to back-fill them (they're excluded from FEFO and from
 * the expiry-warning list, since neither can be computed without a date).
 */
export function lotsMissingExpiry<L extends LotLike>(lots: L[]): L[] {
  return lots.filter((l) => !l.discarded && l.remaining > 0 && l.expiryDate === null);
}

/** All lots (any product) inside the expiry warning window, ascending by days-until-expiry. Rule #8. */
export function expiringLots<L extends LotLike>(
  lots: L[],
  settings: Pick<SettingsLike, 'expiryWarnDays'>,
  today: Date,
): ExpiryFlag<L & { expiryDate: Date }>[] {
  return lots
    .filter((l): l is L & { expiryDate: Date } => !l.discarded && l.remaining > 0 && l.expiryDate !== null)
    .map((lot) => ({ lot, daysUntilExpiry: daysBetween(today, lot.expiryDate) }))
    .filter((x) => x.daysUntilExpiry <= settings.expiryWarnDays)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/** Effect of discarding a lot: what to write back. Rule #8. */
export function discardLotEffect(lot: Pick<LotLike, 'remaining'>, productOnHand: number) {
  return {
    remaining: 0,
    qtyDiscarded: lot.remaining,
    productOnHand: Math.max(0, productOnHand - lot.remaining),
  };
}

/** Suggested reorder quantity shown on the alerts screen. */
export function suggestedReorderQty(
  product: Pick<ProductLike, 'isMachine' | 'unitsPer'>,
  usage: number,
  stock: number,
): number {
  if (isMachine(product)) {
    return Math.max(1, Math.ceil((usage * 2 - stock) / Math.max(1, Number(product.unitsPer) || 1)));
  }
  return Math.max(1, Math.ceil(usage * 2 - stock));
}

// ---- rule #9: price analysis & supplier comparison -----------------------

export interface PriceStats {
  min: number;
  average: number;
  latest: number;
}

/** Min / average / latest per-drug-unit price across ALL lots (incl. discarded) for a product. Rule #9. */
export function priceStatsForProduct<L extends LotLike>(
  lots: L[],
  productId: string,
  product: Pick<ProductLike, 'unitsPer'>,
): PriceStats {
  const ordered = lots
    .filter((l) => l.productId === productId)
    .sort((a, b) => (a.purchaseDate?.getTime() ?? 0) - (b.purchaseDate?.getTime() ?? 0));
  const perUnitValues = ordered.map((l) => perUnitPrice(l, product));
  if (perUnitValues.length === 0) return { min: 0, average: 0, latest: 0 };
  return {
    min: Math.min(...perUnitValues),
    average: perUnitValues.reduce((a, b) => a + b, 0) / perUnitValues.length,
    latest: perUnitValues[perUnitValues.length - 1],
  };
}

export type LotPriceTag = 'min' | 'above-average' | 'normal';

/** Per-lot tag for the price-history table/bars: ★ ต่ำสุด / ▲ above-average / plain. Rule #9. */
export function tagLotPrice(perUnit: number, stats: PriceStats): LotPriceTag {
  if (Math.abs(perUnit - stats.min) < 0.001) return 'min';
  if (perUnit > stats.average) return 'above-average';
  return 'normal';
}

export interface SupplierComparisonRow {
  supplierName: string;
  lotCount: number;
  totalValue: number;
  avgDelta: number;
  isCheapest: boolean;
}

/**
 * For every supplier, average how much its lots run above the cheapest lot
 * ever bought for the same product. Rule #9 (avgDelta <= 0.005 => "ถูกที่สุด").
 */
export function supplierComparison<L extends LotLike>(
  lots: L[],
  productsById: Map<string, Pick<ProductLike, 'unitsPer'>>,
): SupplierComparisonRow[] {
  const supplierNames = Array.from(new Set(lots.map((l) => l.supplierName)));
  return supplierNames.map((name) => {
    const supplierLots = lots.filter((l) => l.supplierName === name);
    const deltas = supplierLots.map((l) => {
      const product = productsById.get(l.productId);
      if (!product) return 0;
      const othersOfSameProduct = lots
        .filter((x) => x.productId === l.productId)
        .map((x) => perUnitPrice(x, product));
      const minForProduct = Math.min(...othersOfSameProduct);
      return perUnitPrice(l, product) - minForProduct;
    });
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    return {
      supplierName: name,
      lotCount: supplierLots.length,
      totalValue: supplierLots.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
      avgDelta,
      isCheapest: avgDelta <= 0.005,
    };
  });
}

/** Inventory value (owner only): onHand * latest non-discarded lot's unit price, summed. Rule #9. */
export function inventoryValue<L extends LotLike>(
  products: Array<{ id: string } & Pick<ProductLike, 'onHand'>>,
  lots: L[],
): number {
  return products.reduce((sum, p) => {
    const latestLot = nonDiscardedLotsByPurchaseDate(lots, p.id).slice(-1)[0];
    return sum + (latestLot ? p.onHand * latestLot.unitPrice : 0);
  }, 0);
}
