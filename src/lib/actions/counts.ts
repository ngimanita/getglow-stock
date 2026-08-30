'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireSession } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { computeUsageRate, resolveCountedQty, roundUsageForSave, isMachine, unitWord } from '@/lib/metrics';
import { stockUnits } from '@/lib/metrics';
import { formatNumber } from '@/lib/format';

export interface SaveCountState {
  error?: string;
  success?: string;
}

export async function saveCountAction(_prev: SaveCountState, formData: FormData): Promise<SaveCountState> {
  const session = await getSession();
  requireSession(session);

  const productId = String(formData.get('productId') || '');
  const countedDateRaw = String(formData.get('countedAt') || '').trim();
  const countedByName = String(formData.get('countedBy') || '').trim();
  const headsCounted = Math.max(0, Number(formData.get('counted')) || 0);
  const openShotsCounted = Math.max(0, Number(formData.get('openShots')) || 0);

  if (!countedByName) return { error: 'ใส่ชื่อคนนับก่อนนะ เอาไว้ย้อนดูได้ว่าใครนับรอบไหน' };
  if (!countedDateRaw) return { error: 'ใส่วันที่นับก่อนนะ' };

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: 'ไม่พบสินค้านี้' };

  const countedAt = new Date(countedDateRaw);
  const prevCount = await prisma.stockCount.findFirst({ where: { productId }, orderBy: { countedAt: 'desc' } });
  const prevCountedAt = prevCount ? prevCount.countedAt : product.lastCountAt;
  const prevQty = prevCount ? prevCount.qty : stockUnits(product);

  const isM = isMachine(product);
  const lotsInWindow = await prisma.lot.findMany({
    where: { productId, purchaseDate: { gt: prevCountedAt, lte: countedAt } },
  });
  const receivedQtySum = lotsInWindow.reduce((sum, l) => sum + l.qty * (isM ? product.unitsPer : 1), 0);

  const counted = resolveCountedQty({ isMachine: isM, unitsPer: product.unitsPer, headsCounted, openShotsCounted });
  const usage = computeUsageRate({
    storedUsagePerMonth: product.usagePerMonth,
    prevCountedAt,
    prevQty,
    newCountedAt: countedAt,
    receivedQtySum,
    counted,
  });
  const savedRate = roundUsageForSave(usage.rate);

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        onHand: isM ? headsCounted : counted,
        openShots: isM ? openShotsCounted : 0,
        usagePerMonth: savedRate,
        lastCountAt: countedAt,
      },
    }),
    prisma.stockCount.create({
      data: {
        productId,
        countedAt,
        qty: counted,
        headsCounted: isM ? headsCounted : null,
        openShots: isM ? openShotsCounted : null,
        ratePerMonth: savedRate,
        countedByName,
        countedById: session.userId,
      },
    }),
  ]);

  const message = isM
    ? `อัปเดตยอด ${product.name} เป็น ${formatNumber(headsCounted)} หัว + ${formatNumber(openShotsCounted)} shot · นับโดย ${countedByName}`
    : `อัปเดตยอด ${product.name} เป็น ${formatNumber(counted)} ${unitWord(product)} · นับโดย ${countedByName}`;
  await logAudit(session, 'count.create', message);

  revalidatePath('/dashboard');
  revalidatePath('/stock-count');
  revalidatePath('/alerts');
  return { success: message };
}
