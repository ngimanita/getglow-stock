import { prisma } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';

export async function logAudit(session: SessionPayload, action: string, detail: string) {
  await prisma.auditLog.create({
    data: { userId: session.userId, userName: session.displayName, action, detail },
  });
}
