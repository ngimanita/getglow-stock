'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireOwner } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { hashPin } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export interface ActionState {
  error?: string;
  success?: string;
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);

  const leadTimeDays = Math.max(0, Number(formData.get('leadTimeDays')) || 0);
  const safetyStockDays = Math.max(0, Number(formData.get('safetyStockDays')) || 0);
  const expiryWarnDays = Math.max(1, Number(formData.get('expiryWarnDays')) || 1);

  await prisma.setting.upsert({
    where: { id: 1 },
    update: { leadTimeDays, safetyStockDays, expiryWarnDays },
    create: { id: 1, leadTimeDays, safetyStockDays, expiryWarnDays },
  });
  await logAudit(session, 'settings.update', `lead=${leadTimeDays} safety=${safetyStockDays} expiryWarn=${expiryWarnDays}`);

  revalidatePath('/', 'layout');
  return { success: 'บันทึกการตั้งค่าแล้ว' };
}

export async function addProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);

  const name = String(formData.get('name') || '').trim();
  const category = String(formData.get('category') || '').trim() || 'อื่น ๆ';
  const unitWord = String(formData.get('unitWord') || '').trim() || 'ชิ้น';
  const isMachine = formData.get('isMachine') === 'on';
  const subUnitWord = String(formData.get('subUnitWord') || '').trim() || 'shot';
  const unitsPer = Math.max(1, Number(formData.get('unitsPer')) || 1);
  const usagePerMonth = Math.max(0.1, Number(formData.get('usagePerMonth')) || 1);

  if (!name) return { error: 'พิมพ์ชื่อสินค้าก่อนนะ' };

  await prisma.product.create({
    data: { name, category, unitWord, isMachine, subUnitWord, unitsPer, usagePerMonth, onHand: 0, openShots: 0, lastCountAt: new Date() },
  });
  await logAudit(session, 'product.create', `เพิ่มสินค้า ${name}`);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: `เพิ่ม ${name} เข้าระบบแล้ว — ไปบันทึกล็อตซื้อเข้าได้เลย` };
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);

  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '').trim();
  const category = String(formData.get('category') || '').trim() || 'อื่น ๆ';
  const unitWord = String(formData.get('unitWord') || '').trim() || 'ชิ้น';
  const isMachine = formData.get('isMachine') === 'on';
  const subUnitWord = String(formData.get('subUnitWord') || '').trim() || 'shot';
  const unitsPer = Math.max(1, Number(formData.get('unitsPer')) || 1);
  const usagePerMonth = Math.max(0.1, Number(formData.get('usagePerMonth')) || 1);

  if (!id) return { error: 'ไม่พบสินค้านี้' };
  if (!name) return { error: 'พิมพ์ชื่อสินค้าก่อนนะ' };

  const product = await prisma.product.update({
    where: { id },
    data: { name, category, unitWord, isMachine, subUnitWord, unitsPer, usagePerMonth },
  });
  await logAudit(session, 'product.update', `แก้ไขสินค้า ${product.name}`);

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: `บันทึกการแก้ไข ${product.name} แล้ว` };
}

export async function setProductArchivedAction(productId: string, archived: boolean): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);
  const product = await prisma.product.update({ where: { id: productId }, data: { archived } });
  await logAudit(session, archived ? 'product.archive' : 'product.unarchive', product.name);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: archived ? `เก็บ ${product.name} เข้าคลังแล้ว` : `นำ ${product.name} กลับมาใช้งานแล้ว` };
}

/** Permanent delete — only allowed when the product has no purchase/count history (nothing to lose). Otherwise archive instead. */
export async function deleteProductAction(productId: string): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: 'ไม่พบสินค้านี้' };

  const [lotCount, countCount] = await Promise.all([
    prisma.lot.count({ where: { productId } }),
    prisma.stockCount.count({ where: { productId } }),
  ]);
  if (lotCount > 0 || countCount > 0) {
    return { error: `ลบไม่ได้ — ${product.name} มีประวัติล็อต/นับสต๊อกอยู่แล้ว (${lotCount} ล็อต, ${countCount} ครั้งที่นับ) กด "เก็บเข้าคลัง" แทนได้` };
  }

  await prisma.product.delete({ where: { id: productId } });
  await logAudit(session, 'product.delete', product.name);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: `ลบ ${product.name} ออกจากระบบแล้ว` };
}

export async function addSupplierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);
  const name = String(formData.get('name') || '').trim();
  if (!name) return { error: 'พิมพ์ชื่อซัพพลายเออร์ก่อนนะ' };
  const contact = String(formData.get('contact') || '').trim() || null;
  const lineId = String(formData.get('lineId') || '').trim() || null;

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) return { error: 'มีซัพพลายเออร์ชื่อนี้อยู่แล้ว' };

  await prisma.supplier.create({ data: { name, contact, lineId } });
  await logAudit(session, 'supplier.create', name);
  revalidatePath('/settings');
  return { success: `เพิ่ม ${name} แล้ว` };
}

export async function addUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);
  const displayName = String(formData.get('displayName') || '').trim();
  const role = String(formData.get('role') || 'stock') === 'owner' ? UserRole.owner : UserRole.stock;
  const pin = String(formData.get('pin') || '').trim();

  if (!displayName) return { error: 'พิมพ์ชื่อพนักงานก่อนนะ' };
  if (!/^\d{4}$/.test(pin)) return { error: 'PIN ต้องเป็นตัวเลข 4 หลัก' };

  const existing = await prisma.user.findFirst({ where: { displayName } });
  if (existing) return { error: 'มีชื่อนี้ในระบบแล้ว' };

  await prisma.user.create({ data: { displayName, role, pinHash: await hashPin(pin) } });
  await logAudit(session, 'user.create', `${displayName} (${role})`);
  revalidatePath('/settings');
  revalidatePath('/login');
  return { success: `เพิ่มผู้ใช้งาน ${displayName} แล้ว` };
}

export async function resetPinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);
  const userId = String(formData.get('userId') || '');
  const pin = String(formData.get('pin') || '').trim();
  if (!/^\d{4}$/.test(pin)) return { error: 'PIN ต้องเป็นตัวเลข 4 หลัก' };

  const user = await prisma.user.update({
    where: { id: userId },
    data: { pinHash: await hashPin(pin), failedAttempts: 0, lockedUntil: null },
  });
  await logAudit(session, 'user.reset_pin', user.displayName);
  revalidatePath('/settings');
  return { success: `ตั้ง PIN ใหม่ให้ ${user.displayName} แล้ว` };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const session = await getSession();
  requireOwner(session);
  const user = await prisma.user.update({ where: { id: userId }, data: { active } });
  await logAudit(session, active ? 'user.activate' : 'user.deactivate', user.displayName);
  revalidatePath('/settings');
  revalidatePath('/login');
  return { success: active ? `เปิดใช้งาน ${user.displayName} แล้ว` : `ปิดใช้งาน ${user.displayName} แล้ว` };
}
