import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSettings, today } from '@/lib/queries';
import * as M from '@/lib/metrics';
import { toISODate } from '@/lib/format';
import { toCSV, STOCK_CSV_HEADER } from '@/lib/csv';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const [products, settings] = await Promise.all([prisma.product.findMany({ where: { archived: false } }), getSettings()]);
  const t = today();
  const rows = products.map((p) => {
    const m = M.computeMetrics(p, settings, t);
    return [p.name, p.type, M.stockUnits(p), M.countWord(p.type), m.usage, m.daysLeft, toISODate(m.deplete), toISODate(m.reorder), M.statusLabel(m.status)];
  });

  await logAudit(session, 'export.stock_csv', `${rows.length} products`);

  return new NextResponse(toCSV([STOCK_CSV_HEADER, ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="getglow-stock-${toISODate(t)}.csv"`,
    },
  });
}
