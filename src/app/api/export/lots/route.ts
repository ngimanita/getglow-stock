import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireOwner } from '@/lib/permissions';
import { today } from '@/lib/queries';
import { perUnitPrice } from '@/lib/metrics';
import { toISODate } from '@/lib/format';
import { toCSV, LOTS_CSV_HEADER } from '@/lib/csv';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const lots = await prisma.lot.findMany({ include: { product: true }, orderBy: { createdAt: 'asc' } });
  const rows = lots.map((l) => [
    l.product.name,
    l.purchaseDate ? toISODate(l.purchaseDate) : '',
    l.expiryDate ? toISODate(l.expiryDate) : '',
    l.qty,
    l.unitPrice,
    l.product.unitsPer,
    perUnitPrice(l, l.product).toFixed(2),
    l.supplierName,
    l.remaining,
  ]);

  await logAudit(session!, 'export.lots_csv', `${rows.length} lots`);

  return new NextResponse(toCSV([LOTS_CSV_HEADER, ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="getglow-lots-${toISODate(today())}.csv"`,
    },
  });
}
