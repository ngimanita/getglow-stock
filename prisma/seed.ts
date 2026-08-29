// Dev/staging seed data.
//
// The first 6 products carry GETGLOW Clinic's real numbers as given by the
// clinic (real purchase lots + the 2026-08-18 stock count). Two of the real
// products (Nabota 100U/200U) had lots with no recorded purchase date at
// hand-off time — `purchaseDate` is left null for those, matching the
// design README's explicit call-out that this must be a fillable field, not
// a guessed one. Likewise none of the real lots came with an expiry date,
// so `expiryDate` is left null rather than fabricated — a wrong guess here
// would corrupt FEFO/expiry alerts for real injectable stock. Fill both in
// from the real boxes via "รับเข้าล็อต" once available.
//
// The remaining 6 products (2 more botox/filler lines, Rejuran, and 2
// machine-tip products) are carried over from the design prototype's demo
// dataset so the machine/shot flow and a fuller price-comparison view have
// something to show; their usage rates are the prototype's own placeholders
// and should be corrected by an early stock count.

import { PrismaClient, ProductType, UserRole } from '@prisma/client';
import { hashPin } from '../src/lib/auth';

const prisma = new PrismaClient();

function d(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.stockCount.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.create({
    data: { id: 1, leadTimeDays: 10, safetyStockDays: 7, expiryWarnDays: 45 },
  });

  const [owner, staffMin, staffBel] = await Promise.all([
    prisma.user.create({
      data: { displayName: 'หมองิ้ม', role: UserRole.owner, pinHash: await hashPin('1234') },
    }),
    prisma.user.create({
      data: { displayName: 'น้องมิ้น (คลังยา)', role: UserRole.stock, pinHash: await hashPin('1111') },
    }),
    prisma.user.create({
      data: { displayName: 'น้องเบล (คลังยา)', role: UserRole.stock, pinHash: await hashPin('2222') },
    }),
  ]);

  const supplierNames = ['เมดิก้า ซัพพลาย', 'บิวตี้เมด', 'เค-ดาร์ม', 'แอลเลอร์แกน ไทย'];
  const suppliers = new Map<string, { id: string }>();
  for (const name of supplierNames) {
    suppliers.set(name, await prisma.supplier.create({ data: { name } }));
  }
  const supplierId = (name: string) => suppliers.get(name)!.id;

  const COUNT_DATE = d('2026-08-18');

  // ---- 1. Neuronox 200U (real) -------------------------------------------
  const nx200 = await prisma.product.create({
    data: {
      name: 'Neuronox 200U',
      type: ProductType.botox,
      unitsPer: 200,
      onHand: 33,
      usagePerMonth: 3.2, // bootstrapped from (50-33)/158d*30 — see prisma/seed.ts header
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nx200.id,
      purchaseDate: d('2026-03-13'),
      expiryDate: null,
      qty: 50,
      unitPrice: 4350,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 33,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nx200.id,
      countedAt: COUNT_DATE,
      qty: 33,
      ratePerMonth: 3.2,
      countedByName: staffMin.displayName,
      countedById: staffMin.id,
    },
  });

  // ---- 2. Neuronox 100U (real) -------------------------------------------
  const nx100 = await prisma.product.create({
    data: {
      name: 'Neuronox 100U',
      type: ProductType.botox,
      unitsPer: 100,
      onHand: 45,
      usagePerMonth: 4.6, // (80-45)/226d*30
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nx100.id,
      purchaseDate: d('2026-01-04'),
      expiryDate: null,
      qty: 80,
      unitPrice: 2532,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 45,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nx100.id,
      countedAt: COUNT_DATE,
      qty: 45,
      ratePerMonth: 4.6,
      countedByName: staffMin.displayName,
      countedById: staffMin.id,
    },
  });

  // ---- 3. Neuramis Deep (real, 2 lots) ------------------------------------
  const nmd = await prisma.product.create({
    data: {
      name: 'Neuramis Deep',
      type: ProductType.filler,
      unitsPer: 1,
      onHand: 20,
      usagePerMonth: 14.2, // (190-20)/359d*30
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nmd.id,
      purchaseDate: d('2025-08-24'),
      expiryDate: null,
      qty: 155,
      unitPrice: 1380,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 0,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nmd.id,
      purchaseDate: d('2026-03-12'),
      expiryDate: null,
      qty: 35,
      unitPrice: 1545,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 20,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nmd.id,
      countedAt: COUNT_DATE,
      qty: 20,
      ratePerMonth: 14.2,
      countedByName: staffBel.displayName,
      countedById: staffBel.id,
    },
  });

  // ---- 4. Neuramis Gold (real) --------------------------------------------
  const nmg = await prisma.product.create({
    data: {
      name: 'Neuramis Gold',
      type: ProductType.filler,
      unitsPer: 1,
      onHand: 58,
      usagePerMonth: 9.3, // (155-58)/314d*30
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nmg.id,
      purchaseDate: d('2025-10-08'),
      expiryDate: null,
      qty: 155,
      unitPrice: 1490,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 58,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nmg.id,
      countedAt: COUNT_DATE,
      qty: 58,
      ratePerMonth: 9.3,
      countedByName: staffBel.displayName,
      countedById: staffBel.id,
    },
  });

  // ---- 5. Nabota 200U (real, purchase date unknown) ------------------------
  const nb200 = await prisma.product.create({
    data: {
      name: 'Nabota 200U',
      type: ProductType.botox,
      unitsPer: 200,
      onHand: 41,
      usagePerMonth: 2, // no purchase date to bootstrap from — carried from initial estimate, correct on next count
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nb200.id,
      purchaseDate: null,
      expiryDate: null,
      qty: 47,
      unitPrice: 4787,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 41,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nb200.id,
      countedAt: COUNT_DATE,
      qty: 41,
      ratePerMonth: 2,
      countedByName: staffMin.displayName,
      countedById: staffMin.id,
    },
  });

  // ---- 6. Nabota 100U (real, 2 lots, purchase dates unknown) ---------------
  const nb100 = await prisma.product.create({
    data: {
      name: 'Nabota 100U',
      type: ProductType.botox,
      unitsPer: 100,
      onHand: 56,
      usagePerMonth: 5,
      lastCountAt: COUNT_DATE,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nb100.id,
      purchaseDate: null,
      expiryDate: null,
      qty: 49,
      unitPrice: 3797,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 0,
    },
  });
  await prisma.lot.create({
    data: {
      productId: nb100.id,
      purchaseDate: null,
      expiryDate: null,
      qty: 47,
      unitPrice: 2925,
      supplierId: null,
      supplierName: 'ไม่ระบุ',
      remaining: 56,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: nb100.id,
      countedAt: COUNT_DATE,
      qty: 56,
      ratePerMonth: 5,
      countedByName: staffMin.displayName,
      countedById: staffMin.id,
    },
  });

  // ---- 7-10. carried over from the design prototype's demo dataset --------
  const alg = await prisma.product.create({
    data: {
      name: 'Botox Allergan 100U',
      type: ProductType.botox,
      unitsPer: 100,
      onHand: 1,
      usagePerMonth: 2.5,
      lastCountAt: d('2026-08-22'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: alg.id,
      purchaseDate: d('2026-01-15'),
      expiryDate: d('2026-10-12'),
      qty: 4,
      unitPrice: 7900,
      supplierId: supplierId('แอลเลอร์แกน ไทย'),
      supplierName: 'แอลเลอร์แกน ไทย',
      remaining: 1,
    },
  });

  const juv = await prisma.product.create({
    data: {
      name: 'Juvederm Volift',
      type: ProductType.filler,
      unitsPer: 1,
      onHand: 5,
      usagePerMonth: 4,
      lastCountAt: d('2026-08-26'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: juv.id,
      purchaseDate: d('2026-04-22'),
      expiryDate: d('2027-09-01'),
      qty: 8,
      unitPrice: 4300,
      supplierId: supplierId('แอลเลอร์แกน ไทย'),
      supplierName: 'แอลเลอร์แกน ไทย',
      remaining: 5,
    },
  });

  const res = await prisma.product.create({
    data: {
      name: 'Restylane Lyft',
      type: ProductType.filler,
      unitsPer: 1,
      onHand: 9,
      usagePerMonth: 3,
      lastCountAt: d('2026-08-18'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: res.id,
      purchaseDate: d('2026-03-30'),
      expiryDate: d('2027-11-20'),
      qty: 12,
      unitPrice: 3900,
      supplierId: supplierId('เค-ดาร์ม'),
      supplierName: 'เค-ดาร์ม',
      remaining: 9,
    },
  });

  const rej = await prisma.product.create({
    data: {
      name: 'Rejuran Healer',
      type: ProductType.other,
      unitsPer: 1,
      onHand: 12,
      usagePerMonth: 10,
      lastCountAt: d('2026-08-27'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: rej.id,
      purchaseDate: d('2026-07-01'),
      expiryDate: d('2027-01-25'),
      qty: 20,
      unitPrice: 2400,
      supplierId: supplierId('เค-ดาร์ม'),
      supplierName: 'เค-ดาร์ม',
      remaining: 12,
    },
  });

  // ---- 11-12. machine tips (demo — exercises the machine/shot flow) -------
  const umpt = await prisma.product.create({
    data: {
      name: 'Ultraformer MPT · หัว 1.5 mm',
      type: ProductType.machine,
      unitsPer: 800,
      onHand: 2,
      openShots: 240,
      usagePerMonth: 900,
      lastCountAt: d('2026-08-26'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: umpt.id,
      purchaseDate: d('2026-03-12'),
      expiryDate: d('2028-03-01'),
      qty: 3,
      unitPrice: 26000,
      supplierId: supplierId('เค-ดาร์ม'),
      supplierName: 'เค-ดาร์ม',
      remaining: 0,
    },
  });
  await prisma.lot.create({
    data: {
      productId: umpt.id,
      purchaseDate: d('2026-07-15'),
      expiryDate: d('2028-06-30'),
      qty: 3,
      unitPrice: 24500,
      supplierId: supplierId('บิวตี้เมด'),
      supplierName: 'บิวตี้เมด',
      remaining: 2,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: umpt.id,
      countedAt: d('2026-07-20'),
      qty: 3040,
      headsCounted: 3,
      openShots: 640,
      ratePerMonth: 950,
      countedByName: staffBel.displayName,
      countedById: staffBel.id,
    },
  });
  await prisma.stockCount.create({
    data: {
      productId: umpt.id,
      countedAt: d('2026-08-26'),
      qty: 1840,
      headsCounted: 2,
      openShots: 240,
      ratePerMonth: 900,
      countedByName: staffMin.displayName,
      countedById: staffMin.id,
    },
  });

  const thm = await prisma.product.create({
    data: {
      name: 'Thermage FLX · Tip 4.0',
      type: ProductType.machine,
      unitsPer: 900,
      onHand: 1,
      openShots: 150,
      usagePerMonth: 700,
      lastCountAt: d('2026-08-24'),
    },
  });
  await prisma.lot.create({
    data: {
      productId: thm.id,
      purchaseDate: d('2026-06-05'),
      expiryDate: d('2028-01-31'),
      qty: 2,
      unitPrice: 38000,
      supplierId: supplierId('แอลเลอร์แกน ไทย'),
      supplierName: 'แอลเลอร์แกน ไทย',
      remaining: 1,
    },
  });

  console.log('Seed complete.');
  console.log('Login demo: หมองิ้ม / 1234 (เจ้าของ) · น้องมิ้น (คลังยา) / 1111 · น้องเบล (คลังยา) / 2222');
  void owner;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
