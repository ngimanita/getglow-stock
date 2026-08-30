// Unit tests for the business-logic core (rules #1-#9 from the design
// handoff README). These numbers matter — they drive real reorder decisions
// for the clinic — so every function gets at least one test, and the
// branchy ones (usage-rate blending, status thresholds) get one per branch.

import { describe, it, expect } from 'vitest';
import { formatThaiDate, formatNumber, formatBaht, parseLocalDate, daysBetween, addDays } from './format';
import {
  perUnitPrice,
  stockUnits,
  stockText,
  computeMetrics,
  threshold,
  reorderDateText,
  computeUsageRate,
  resolveCountedQty,
  clampOpenShots,
  roundUsageForSave,
  fefoNextLot,
  expiringLots,
  lotsMissingExpiry,
  discardLotEffect,
  suggestedReorderQty,
  priceStatsForProduct,
  tagLotPrice,
  supplierComparison,
  inventoryValue,
  nonDiscardedLotsByPurchaseDate,
  type LotLike,
  type ProductLike,
} from './metrics';

const D = parseLocalDate;

function makeLot(overrides: Partial<LotLike> & { id: string; productId: string }): LotLike {
  return {
    purchaseDate: D('2026-01-01'),
    expiryDate: D('2027-01-01'),
    qty: 10,
    unitPrice: 1000,
    supplierName: 'Test Supplier',
    remaining: 10,
    discarded: false,
    qtyDiscarded: null,
    ...overrides,
  };
}

// ---- format.ts -----------------------------------------------------------

describe('formatThaiDate', () => {
  it('renders Buddhist-era 2-digit year with Thai month abbreviation', () => {
    expect(formatThaiDate(D('2026-08-29'))).toBe('29 ส.ค. 69');
  });
});

describe('formatNumber / formatBaht', () => {
  it('formats with comma thousands and drops unneeded decimals by default', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });
  it('formats money with a forced 2-decimal option and a baht sign', () => {
    expect(formatBaht(43.5, 2)).toBe('43.50 ฿');
  });
});

describe('daysBetween / addDays', () => {
  it('computes whole-day differences and offsets', () => {
    expect(daysBetween(D('2026-08-25'), D('2026-08-29'))).toBe(4);
    expect(addDays(D('2026-08-29'), 11).getTime()).toBe(D('2026-09-09').getTime());
  });
});

// ---- rule #1: price per drug unit -----------------------------------------

describe('perUnitPrice (rule #1)', () => {
  it('divides lot price by units-per-item for multi-unit products (100U vial)', () => {
    expect(perUnitPrice({ unitPrice: 2700 }, { unitsPer: 100 })).toBe(27);
  });
  it('divides by 200 for a 200U vial, making cross-size prices comparable', () => {
    expect(perUnitPrice({ unitPrice: 4700 }, { unitsPer: 200 })).toBe(23.5);
  });
  it('does not divide for single-unit products (filler box, unitsPer=1)', () => {
    expect(perUnitPrice({ unitPrice: 1380 }, { unitsPer: 1 })).toBe(1380);
  });
});

// ---- stockUnits / stockText -----------------------------------------------

describe('stockUnits', () => {
  it('is just onHand for non-machine products', () => {
    expect(stockUnits({ isMachine: false, onHand: 33, openShots: 0, unitsPer: 200 })).toBe(33);
  });
  it('is onHand*unitsPer + openShots for machine products', () => {
    expect(stockUnits({ isMachine: true, onHand: 2, openShots: 240, unitsPer: 800 })).toBe(1840);
  });
});

describe('stockText', () => {
  const fmt = (v: number) => formatNumber(v);
  it('reads "{n} {unitWord}" for non-machine', () => {
    expect(stockText({ isMachine: false, onHand: 33, openShots: 0, unitWord: 'ขวด' }, fmt)).toBe('33 ขวด');
  });
  it('reads "{n} หัว + {n} shot" for machine', () => {
    expect(stockText({ isMachine: true, onHand: 2, openShots: 240, unitWord: 'หัว' }, fmt)).toBe('2 หัว + 240 shot');
  });
});

// ---- rules #4-7: metrics / status / reorder --------------------------------

const SETTINGS = { leadTimeDays: 10, safetyStockDays: 7, expiryWarnDays: 45 }; // design defaults
const TODAY = D('2026-08-29'); // pinned "today" from the prototype

describe('threshold', () => {
  it('is leadTimeDays + safetyStockDays', () => {
    expect(threshold(SETTINGS)).toBe(17);
  });
});

describe('computeMetrics (rules #4-7)', () => {
  it('reproduces the seed dataset\'s Neuronox 100U card exactly (3 ขวด, 11 วัน, สั่งซื้อด่วน)', () => {
    const product: ProductLike = {
      category: 'โบท็อกซ์',
      unitWord: 'ขวด',
      isMachine: false,
      unitsPer: 100,
      onHand: 3,
      openShots: 0,
      usagePerMonth: 6,
      lastCountAt: D('2026-08-25'),
    };
    const m = computeMetrics(product, SETTINGS, TODAY);
    expect(m.daysLeft).toBe(11);
    expect(m.deplete.getTime()).toBe(D('2026-09-09').getTime());
    expect(m.reorder.getTime()).toBe(D('2026-08-23').getTime());
    expect(m.status).toBe('urgent'); // daysLeft(11) <= threshold(17)
  });

  it('extrapolates deplete/reorder dates from a stale last-count using elapsed days', () => {
    const product: ProductLike = {
      category: 'ฟิลเลอร์',
      unitWord: 'กล่อง',
      isMachine: false,
      unitsPer: 1,
      onHand: 30,
      openShots: 0,
      usagePerMonth: 6, // perDay=0.2 -> daysLeftRaw = round(30/0.2) = 150
      lastCountAt: D('2026-07-01'), // elapsed = days(07-01 -> 08-29) = 59
    };
    const m = computeMetrics(product, SETTINGS, TODAY);
    expect(m.deplete.getTime()).toBe(addDays(TODAY, 150 - 59).getTime());
    expect(m.daysLeft).toBe(91); // days(today -> deplete)
    expect(m.status).toBe('ok'); // 91 > threshold(17)+21
  });

  it('flags "soon" precisely at the threshold+1..threshold+21 boundary', () => {
    // Construct daysLeft to land exactly at threshold+21 (=38) by using a fresh count.
    const product: ProductLike = {
      category: 'อื่น ๆ',
      unitWord: 'ชิ้น',
      isMachine: false,
      unitsPer: 1,
      onHand: 38 * 1, // perDay will be 1/30 -> daysLeftRaw = round(38/(1/30)) is too big; instead set usage so perDay=1
      openShots: 0,
      usagePerMonth: 30, // perDay = 1/day
      lastCountAt: TODAY, // elapsed = 0, so daysLeft == daysLeftRaw == onHand
    };
    const m = computeMetrics(product, SETTINGS, TODAY);
    expect(m.daysLeft).toBe(38);
    expect(m.status).toBe('soon'); // 38 <= 17+21
  });

  it('flags "ok" once daysLeft exceeds threshold+21', () => {
    const product: ProductLike = {
      category: 'อื่น ๆ',
      unitWord: 'ชิ้น',
      isMachine: false,
      unitsPer: 1,
      onHand: 39,
      openShots: 0,
      usagePerMonth: 30, // perDay = 1/day
      lastCountAt: TODAY,
    };
    const m = computeMetrics(product, SETTINGS, TODAY);
    expect(m.daysLeft).toBe(39);
    expect(m.status).toBe('ok');
  });

  it('flags "urgent" once daysLeft drops to the threshold', () => {
    const product: ProductLike = {
      category: 'อื่น ๆ',
      unitWord: 'ชิ้น',
      isMachine: false,
      unitsPer: 1,
      onHand: 17,
      openShots: 0,
      usagePerMonth: 30,
      lastCountAt: TODAY,
    };
    const m = computeMetrics(product, SETTINGS, TODAY);
    expect(m.daysLeft).toBe(17);
    expect(m.status).toBe('urgent');
  });
});

describe('reorderDateText', () => {
  const fmt = (d: Date) => formatThaiDate(d);
  it('shows "สั่งเลยวันนี้" once the reorder date has arrived or passed', () => {
    expect(reorderDateText(D('2026-08-23'), TODAY, fmt)).toBe('สั่งเลยวันนี้');
    expect(reorderDateText(TODAY, TODAY, fmt)).toBe('สั่งเลยวันนี้');
  });
  it('otherwise shows the formatted future date', () => {
    expect(reorderDateText(D('2026-09-15'), TODAY, fmt)).toBe(formatThaiDate(D('2026-09-15')));
  });
});

// ---- rules #2-#3: usage rate from a stock count ----------------------------

describe('resolveCountedQty / clampOpenShots', () => {
  it('is the raw entered number for non-machine products', () => {
    expect(resolveCountedQty({ isMachine: false, unitsPer: 1, headsCounted: 33, openShotsCounted: 0 })).toBe(33);
  });
  it('is heads*unitsPer + clamped open shots for machine products', () => {
    expect(resolveCountedQty({ isMachine: true, unitsPer: 800, headsCounted: 2, openShotsCounted: 240 })).toBe(1840);
  });
  it('clamps open-shots input into [0, unitsPer]', () => {
    expect(clampOpenShots(-5, 800)).toBe(0);
    expect(clampOpenShots(5000, 800)).toBe(800);
    expect(clampOpenShots(240, 800)).toBe(240);
  });
});

describe('computeUsageRate (rule #3 — "the smart part")', () => {
  it('blends window rate with the stored rate when gap>=14 days and usage moved', () => {
    // used = 15 over 30 days -> windowRate = 15; blended with stored=6 over 30 stored-days
    const r = computeUsageRate({
      storedUsagePerMonth: 6,
      prevCountedAt: D('2026-07-30'),
      prevQty: 20,
      newCountedAt: D('2026-08-29'), // gap = 30
      receivedQtySum: 0,
      counted: 5, // used = 20 + 0 - 5 = 15
    });
    expect(r.gap).toBe(30);
    expect(r.used).toBe(15);
    expect(r.windowRate).toBe(15);
    expect(r.useWindow).toBe(true);
    expect(r.rate).toBeCloseTo((15 * 30 + 6 * 30) / 60, 6); // 10.5
    expect(r.note).toBe('คิดจากยอดนับรอบนี้ถ่วงกับอัตราเดิม');
  });

  it('falls back to the stored rate when nothing was used since the last count', () => {
    const r = computeUsageRate({
      storedUsagePerMonth: 6,
      prevCountedAt: D('2026-07-30'),
      prevQty: 20,
      newCountedAt: D('2026-08-29'), // gap = 30, plenty long
      receivedQtySum: 0,
      counted: 20, // used = 0
    });
    expect(r.used).toBe(0);
    expect(r.useWindow).toBe(false);
    expect(r.rate).toBe(6);
    expect(r.note).toBe('ยอดไม่ขยับตั้งแต่นับครั้งก่อน — ใช้อัตราเดิมที่บันทึกไว้');
  });

  it('falls back to the stored rate when the counting gap is under 14 days', () => {
    const r = computeUsageRate({
      storedUsagePerMonth: 6,
      prevCountedAt: D('2026-08-20'),
      prevQty: 20,
      newCountedAt: D('2026-08-29'), // gap = 9
      receivedQtySum: 0,
      counted: 10, // used = 10 > 0, but gap < 14
    });
    expect(r.gap).toBe(9);
    expect(r.used).toBe(10);
    expect(r.useWindow).toBe(false);
    expect(r.rate).toBe(6);
    expect(r.note).toBe('ช่วงนับสั้นกว่า 14 วัน — ใช้อัตราเดิมที่บันทึกไว้');
  });

  it('folds received lots into the "used" calculation (rule #2)', () => {
    // prev=20, received=12 (two lots), counted=25 -> used = 20+12-25 = 7
    const r = computeUsageRate({
      storedUsagePerMonth: 6,
      prevCountedAt: D('2026-07-30'),
      prevQty: 20,
      newCountedAt: D('2026-08-29'),
      receivedQtySum: 12,
      counted: 25,
    });
    expect(r.used).toBe(7);
  });
});

describe('roundUsageForSave', () => {
  it('rounds to 1 decimal', () => {
    expect(roundUsageForSave(10.46)).toBe(10.5);
  });
  it('floors at 0.2 even when the blended rate is nearly zero', () => {
    expect(roundUsageForSave(0.05)).toBe(0.2);
  });
});

// ---- rule #8: FEFO & expiry -------------------------------------------------

describe('fefoNextLot', () => {
  it('picks the non-discarded, in-stock lot with the earliest expiry', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', expiryDate: D('2027-01-01'), remaining: 5 }),
      makeLot({ id: 'l2', productId: 'p1', expiryDate: D('2026-09-20'), remaining: 3 }),
      makeLot({ id: 'l3', productId: 'p1', expiryDate: D('2026-06-01'), remaining: 0 }), // depleted, skipped
      makeLot({ id: 'l4', productId: 'p1', expiryDate: D('2026-08-01'), remaining: 4, discarded: true }), // skipped
    ];
    expect(fefoNextLot(lots, 'p1')?.id).toBe('l2');
  });
});

describe('expiringLots', () => {
  it('includes already-expired lots (negative days) and filters/sorts by the warning window', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', expiryDate: D('2026-10-01'), remaining: 3 }), // 33 days out
      makeLot({ id: 'l2', productId: 'p1', expiryDate: D('2026-08-01'), remaining: 3 }), // -28 days (expired)
      makeLot({ id: 'l3', productId: 'p1', expiryDate: D('2027-06-01'), remaining: 3 }), // far out, excluded
      makeLot({ id: 'l4', productId: 'p1', expiryDate: D('2026-09-01'), remaining: 0 }), // depleted, excluded
    ];
    const flagged = expiringLots(lots, { expiryWarnDays: 45 }, TODAY);
    expect(flagged.map((f) => f.lot.id)).toEqual(['l2', 'l1']); // most-urgent (most negative) first
    expect(flagged[0].daysUntilExpiry).toBeLessThan(0);
  });
});

describe('lots with an unknown expiry date (back-filled historic records)', () => {
  it('are excluded from FEFO ranking and from the expiry-warning list, and surfaced separately instead', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', expiryDate: null, remaining: 5 }),
      makeLot({ id: 'l2', productId: 'p1', expiryDate: D('2026-09-20'), remaining: 3 }),
    ];
    expect(fefoNextLot(lots, 'p1')?.id).toBe('l2'); // never guesses l1 into the pick order
    expect(expiringLots(lots, { expiryWarnDays: 45 }, TODAY).map((f) => f.lot.id)).toEqual(['l2']);
    expect(lotsMissingExpiry(lots).map((l) => l.id)).toEqual(['l1']);
  });
});

describe('discardLotEffect', () => {
  it('zeroes the lot and decrements product on-hand by its remaining qty', () => {
    const effect = discardLotEffect({ remaining: 5 }, 20);
    expect(effect).toEqual({ remaining: 0, qtyDiscarded: 5, productOnHand: 15 });
  });
  it('never drives product on-hand negative', () => {
    const effect = discardLotEffect({ remaining: 5 }, 3);
    expect(effect.productOnHand).toBe(0);
  });
});

describe('suggestedReorderQty', () => {
  it('suggests ceil(usage*2 - stock), min 1, for non-machine products', () => {
    expect(suggestedReorderQty({ isMachine: false, unitsPer: 100 }, 6, 3)).toBe(9);
  });
  it('divides by unitsPer for machine products, min 1', () => {
    expect(suggestedReorderQty({ isMachine: true, unitsPer: 800 }, 900, 2400)).toBe(1); // usage*2-stock is negative -> floors at 1
    expect(suggestedReorderQty({ isMachine: true, unitsPer: 800 }, 1800, 240)).toBe(5); // ceil((3600-240)/800) = ceil(4.2) = 5
  });
});

// ---- rule #9: price analysis & supplier comparison --------------------------

describe('priceStatsForProduct', () => {
  it('computes min/average/latest per-drug-unit price across all lots including discarded, ordered by purchase date', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', purchaseDate: D('2025-11-10'), unitPrice: 2850 }),
      makeLot({ id: 'l2', productId: 'p1', purchaseDate: D('2026-02-14'), unitPrice: 2650 }),
      makeLot({ id: 'l3', productId: 'p1', purchaseDate: D('2026-06-02'), unitPrice: 2750, discarded: true }),
    ];
    const stats = priceStatsForProduct(lots, 'p1', { unitsPer: 100 });
    expect(stats.min).toBeCloseTo(26.5, 6);
    expect(stats.average).toBeCloseTo((28.5 + 26.5 + 27.5) / 3, 6);
    expect(stats.latest).toBeCloseTo(27.5, 6); // last by purchase date, even though discarded
  });
});

describe('tagLotPrice', () => {
  const stats = { min: 26.5, average: 27.5, latest: 27.5 };
  it('tags the cheapest lot "min"', () => {
    expect(tagLotPrice(26.5, stats)).toBe('min');
  });
  it('tags a lot above average "above-average"', () => {
    expect(tagLotPrice(28, stats)).toBe('above-average');
  });
  it('tags everything else "normal"', () => {
    expect(tagLotPrice(27, stats)).toBe('normal');
  });
});

describe('supplierComparison', () => {
  it('averages each supplier\'s per-lot delta against the cheapest lot for that product, and flags "cheapest"', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', supplierName: 'A', unitPrice: 2650 }), // per-unit 26.5 (min)
      makeLot({ id: 'l2', productId: 'p1', supplierName: 'B', unitPrice: 2850 }), // per-unit 28.5, delta 2
    ];
    const products = new Map([['p1', { unitsPer: 100 }]]);
    const rows = supplierComparison(lots, products);
    const a = rows.find((r) => r.supplierName === 'A')!;
    const b = rows.find((r) => r.supplierName === 'B')!;
    expect(a.avgDelta).toBeCloseTo(0, 6);
    expect(a.isCheapest).toBe(true);
    expect(b.avgDelta).toBeCloseTo(2, 6);
    expect(b.isCheapest).toBe(false);
  });
});

describe('inventoryValue', () => {
  it('sums onHand * latest non-discarded lot price across products', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', purchaseDate: D('2026-01-01'), unitPrice: 2700 }),
      makeLot({ id: 'l2', productId: 'p1', purchaseDate: D('2026-06-01'), unitPrice: 2800 }),
      makeLot({ id: 'l3', productId: 'p2', purchaseDate: D('2026-03-01'), unitPrice: 1500 }),
    ];
    const products = [
      { id: 'p1', onHand: 5 },
      { id: 'p2', onHand: 10 },
    ];
    // p1: latest lot by purchase date is l2 @2800 -> 5*2800=14000; p2: 10*1500=15000
    expect(inventoryValue(products, lots)).toBe(29000);
  });
});

describe('nonDiscardedLotsByPurchaseDate', () => {
  it('excludes discarded lots and sorts oldest purchase first', () => {
    const lots: LotLike[] = [
      makeLot({ id: 'l1', productId: 'p1', purchaseDate: D('2026-03-01') }),
      makeLot({ id: 'l2', productId: 'p1', purchaseDate: D('2026-01-01') }),
      makeLot({ id: 'l3', productId: 'p1', purchaseDate: D('2026-02-01'), discarded: true }),
    ];
    expect(nonDiscardedLotsByPurchaseDate(lots, 'p1').map((l) => l.id)).toEqual(['l2', 'l1']);
  });
});
