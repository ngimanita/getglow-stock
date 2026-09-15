'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireOwner, requireSession } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { perUnitPrice, unitWord } from '@/lib/metrics';
import { formatNumber } from '@/lib/format';

export interface SaveLotState {
  error?: string;
  success?: string;
}

/** Rule: qty>0, price/qty coerce to >=0, expiry required, expiry > purchase (when purchase is known). */
export async function saveLotAction(_prev: SaveLotState, formData: FormData): Promise<SaveLotState> {
  const session = await getSession();
  requireOwner(session);

  const productId = String(formData.get('productId') || '');
  const qty = Math.max(0, Number(formData.get('qty')) || 0);
  const price = Math.max(0, Number(formData.get('price')) || 0);
  const purchaseDateRaw = String(formData.get('purchaseDate') || '').trim();
  const expiryDateRaw = String(formData.get('expiryDate') || '').trim();
  const supplierName = String(formData.get('supplier') || '').trim() || 'ไม่ระบุ';

  if (!qty) return { error: 'ใส่จำนวนที่ซื้อก่อนนะ' };
  if (!expiryDateRaw) return { error: 'ใส่วันหมดอายุก่อนนะ' };

  const purchaseDate = purchaseDateRaw ? new Date(purchaseDateRaw) : null;
  const expiryDate = new Date(expiryDateRaw);
  if (purchaseDate && expiryDate <= purchaseDate) {
    return { error: 'วันหมดอายุต้องมากกว่าวันที่ซื้อ' };
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: 'ไม่พบสินค้านี้' };

  let supplier = await prisma.supplier.findUnique({ where: { name: supplierName } });
  if (!supplier && supplierName !== 'ไม่ระบุ') {
    supplier = await prisma.supplier.create({ data: { name: supplierName } });
  }

  await prisma.$transaction([
    prisma.lot.create({
      data: {
        productId,
        purchaseDate,
        expiryDate,
        qty,
        unitPrice: price,
        supplierId: supplier?.id ?? null,
        supplierName,
        remaining: qty,
        createdById: session.userId,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { onHand: { increment: qty } },
    }),
  ]);

  const perUnit = perUnitPrice({ unitPrice: price }, { unitsPer: product.unitsPer });
  const message = `บันทึกล็อต ${product.name} แล้ว · ${formatNumber(qty)} ${unitWord(product)} ที่ ${formatNumber(perUnit, 2)} ฿/ยูนิต`;
  await logAudit(session, 'lot.create', message);

  revalidatePath('/dashboard');
  revalidatePath('/receive-lot');
  revalidatePath('/alerts');
  revalidatePath('/price-compare');
  return { success: message };
}

/** Edit an already-saved lot (fix a typo'd price/qty/date). Adjusts product.onHand by the qty delta unless the lot was already discarded. */
export async function updateLotAction(_prev: SaveLotState, formData: FormData): Promise<SaveLotState> {
  const session = await getSession();
  requireOwner(session);

  const id = String(formData.get('id') || '');
  const qty = Math.max(0, Number(formData.get('qty')) || 0);
  const price = Math.max(0, Number(formData.get('price')) || 0);
  const purchaseDateRaw = String(formData.get('purchaseDate') || '').trim();
  const expiryDateRaw = String(formData.get('expiryDate') || '').trim();
  const supplierName = String(formData.get('supplier') || '').trim() || 'ไม่ระบุ';

  if (!id) return { error: 'ไม่พบล็อตนี้' };
  if (!qty) return { error: 'ใส่จำนวนที่ซื้อก่อนนะ' };
  if (!expiryDateRaw) return { error: 'ใส่วันหมดอายุก่อนนะ' };

  const lot = await prisma.lot.findUnique({ where: { id } });
  if (!lot) return { error: 'ไม่พบล็อตนี้' };

  const purchaseDate = purchaseDateRaw ? new Date(purchaseDateRaw) : null;
  const expiryDate = new Date(expiryDateRaw);
  if (purchaseDate && expiryDate <= purchaseDate) {
    return { error: 'วันหมดอายุต้องมากกว่าวันที่ซื้อ' };
  }

  let supplier = await prisma.supplier.findUnique({ where: { name: supplierName } });
  if (!supplier && supplierName !== 'ไม่ระบุ') {
    supplier = await prisma.supplier.create({ data: { name: supplierName } });
  }

  const qtyDelta = qty - lot.qty;
  const newRemaining = lot.discarded ? lot.remaining : Math.max(0, lot.remaining + qtyDelta);

  const lotUpdate = prisma.lot.update({
    where: { id },
    data: {
      purchaseDate,
      expiryDate,
      qty,
      unitPrice: price,
      supplierId: supplier?.id ?? null,
      supplierName,
      remaining: newRemaining,
    },
  });
  const shouldAdjustStock = !lot.discarded && qtyDelta !== 0;
  if (shouldAdjustStock) {
    await prisma.$transaction([lotUpdate, prisma.product.update({ where: { id: lot.productId }, data: { onHand: { increment: qtyDelta } } })]);
  } else {
    await lotUpdate;
  }

  const product = await prisma.product.findUnique({ where: { id: lot.productId } });
  if (shouldAdjustStock && product && product.onHand < 0) {
    await prisma.product.update({ where: { id: lot.productId }, data: { onHand: 0 } });
  }

  const message = `แก้ไขล็อต ${product?.name ?? ''} แล้ว`;
  await logAudit(session, 'lot.update', `${message} (lot ${id})`);

  revalidatePath('/dashboard');
  revalidatePath('/receive-lot');
  revalidatePath('/alerts');
  revalidatePath('/price-compare');
  return { success: message };
}

export interface DiscardState {
  error?: string;
  success?: string;
}

export async function discardLotAction(_prev: DiscardState, formData: FormData): Promise<DiscardState> {
  const session = await getSession();
  requireSession(session);

  const lotId = String(formData.get('lotId') || '');
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot || lot.discarded) return { error: 'ไม่พบล็อตนี้ หรือถูกทิ้งไปแล้ว' };

  await prisma.$transaction([
    prisma.lot.update({
      where: { id: lotId },
      data: { discarded: true, qtyDiscarded: lot.remaining, remaining: 0 },
    }),
    prisma.product.update({
      where: { id: lot.productId },
      data: { onHand: { decrement: lot.remaining } },
    }),
  ]);
  // onHand must never go negative — clamp in a follow-up read/write since Prisma decrement can't clamp inline.
  const product = await prisma.product.findUnique({ where: { id: lot.productId } });
  if (product && product.onHand < 0) {
    await prisma.product.update({ where: { id: lot.productId }, data: { onHand: 0 } });
  }

  const message = 'บันทึกทิ้งล็อตหมดอายุแล้ว — ตัดออกจากยอดคงเหลือให้เรียบร้อย';
  await logAudit(session, 'lot.discard', message + ` (lot ${lotId})`);

  revalidatePath('/alerts');
  revalidatePath('/dashboard');
  revalidatePath('/price-compare');
  return { success: message };
}
