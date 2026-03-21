import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { members } from '../db/schema.js';

export type ScopedMember = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'member';
};

export const getScopedMember = async (
  memberId: string,
  organizationId: string,
): Promise<ScopedMember | null> => {
  const rows = await db
    .select({
      id: members.id,
      userId: members.userId,
      organizationId: members.organizationId,
      role: members.role,
    })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
    .limit(1);

  return rows[0] ?? null;
};

export const getMemberById = async (memberId: string): Promise<ScopedMember | null> => {
  const rows = await db
    .select({
      id: members.id,
      userId: members.userId,
      organizationId: members.organizationId,
      role: members.role,
    })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  return rows[0] ?? null;
};

export const isLastOwner = async (organizationId: string): Promise<boolean> => {
  const rows = await db
    .select({ total: count() })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.role, 'owner')));

  return (rows[0]?.total ?? 0) <= 1;
};
