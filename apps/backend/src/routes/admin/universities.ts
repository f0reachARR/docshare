import { randomUUID } from 'node:crypto';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { asc, count, desc, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { invitations, organizations } from '../../db/schema.js';
import {
  createPaginatedResponseSchema,
  createPaginationMeta,
  createPagingQuerySchema,
  parsePagingParams,
} from '../../lib/pagination.js';
import type { AppVariables } from '../../middleware/auth.js';
import { emailService } from '../../services/email/index.js';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  ownerEmail: z.string().email().optional(),
});

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

const listUniversitySortValues = [
  'name:asc',
  'name:desc',
  'slug:asc',
  'slug:desc',
  'createdAt:asc',
  'createdAt:desc',
] as const;

const listUniversityRoute = createRoute({
  method: 'get',
  path: '/universities',
  request: {
    query: createPagingQuerySchema(listUniversitySortValues, true),
  },
  responses: {
    200: {
      description: '大学一覧',
      content: {
        'application/json': {
          schema: createPaginatedResponseSchema(organizationSchema),
        },
      },
    },
    400: {
      description: '不正クエリ',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Invalid query') }),
        },
      },
    },
    422: {
      description: '不正ソート',
      content: {
        'application/json': {
          schema: z.object({ error: z.literal('Invalid sort') }),
        },
      },
    },
  },
});

export const adminUniversityRoutes = new OpenAPIHono<{
  Variables: AppVariables;
}>();

adminUniversityRoutes.post('/universities', async (c) => {
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(organizations)
    .values({
      id: randomUUID(),
      name: body.data.name,
      slug: body.data.slug,
    })
    .returning();

  if (body.data.ownerEmail) {
    const inviter = c.get('currentUser');
    const invitationId = randomUUID();
    await db.insert(invitations).values({
      id: invitationId,
      organizationId: inserted[0].id,
      email: body.data.ownerEmail,
      role: 'owner',
      invitedBy: inviter.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    await emailService.sendEmail({
      to: body.data.ownerEmail,
      subject: `${inserted[0].name} の代表者招待`,
      html: `招待ID: ${invitationId}`,
    });
  }

  return c.json({ data: inserted[0] }, 201);
});

adminUniversityRoutes.openapi(listUniversityRoute, async (c) => {
  const parsed = parsePagingParams({
    query: c.req.query(),
    schema: createPagingQuerySchema(listUniversitySortValues, true),
    sortValues: listUniversitySortValues,
    defaultSort: 'createdAt:desc',
  });
  if (!parsed.ok) {
    if (parsed.status === 400) {
      return c.json({ error: 'Invalid query' as const }, 400);
    }
    return c.json({ error: 'Invalid sort' as const }, 422);
  }

  const whereClause = parsed.value.q
    ? or(
        ilike(organizations.name, `%${parsed.value.q}%`),
        ilike(organizations.slug, `%${parsed.value.q}%`),
      )
    : undefined;

  const totalRows = whereClause
    ? await db.select({ total: count() }).from(organizations).where(whereClause)
    : await db.select({ total: count() }).from(organizations);

  const sortColumn =
    parsed.value.sort.field === 'name'
      ? organizations.name
      : parsed.value.sort.field === 'slug'
        ? organizations.slug
        : organizations.createdAt;
  const mainOrder = parsed.value.sort.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = whereClause
    ? await db
        .select()
        .from(organizations)
        .where(whereClause)
        .orderBy(mainOrder, asc(organizations.id))
        .limit(parsed.value.pageSize)
        .offset(parsed.value.offset)
    : await db
        .select()
        .from(organizations)
        .orderBy(mainOrder, asc(organizations.id))
        .limit(parsed.value.pageSize)
        .offset(parsed.value.offset);

  return c.json(
    {
      data: rows,
      pagination: createPaginationMeta({
        page: parsed.value.page,
        pageSize: parsed.value.pageSize,
        total: totalRows[0]?.total ?? 0,
      }),
    },
    200,
  );
});
