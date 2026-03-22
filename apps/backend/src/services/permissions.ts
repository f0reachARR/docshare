import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  comments,
  competitionEditions,
  members,
  participations,
  submissionTemplates,
  submissions,
  users,
} from '../db/schema.js';

export const forbiddenReasonCodes = [
  'organization_context_required',
  'sharing_status_not_viewable',
  'organization_not_participating',
  'template_not_submitted',
  'template_context_required',
  'participation_not_found',
] as const;

export const publicForbiddenReasonCodes = ['context_required', 'access_denied'] as const;

export type ForbiddenReasonCode = (typeof forbiddenReasonCodes)[number];
export type PublicForbiddenReasonCode = (typeof publicForbiddenReasonCodes)[number];

export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: ForbiddenReasonCode };

export const toPublicForbiddenReason = (reason: ForbiddenReasonCode): PublicForbiddenReasonCode => {
  if (reason === 'organization_context_required' || reason === 'template_context_required') {
    return 'context_required';
  }
  return 'access_denied';
};

export const isAdmin = async (userId: string): Promise<boolean> => {
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.isAdmin ?? false;
};

export const getUserUniversityIds = async (userId: string): Promise<string[]> => {
  const rows = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId));
  return rows.map((row) => row.organizationId);
};

export const canViewOtherSubmissionsByTemplate = async (
  userId: string,
  editionId: string,
  templateId: string,
  organizationIdHeader: string | null,
): Promise<PermissionDecision> => {
  if (await isAdmin(userId)) {
    return { allowed: true };
  }

  if (!organizationIdHeader) {
    return { allowed: false, reason: 'organization_context_required' };
  }

  const editionRows = await db
    .select({ sharingStatus: competitionEditions.sharingStatus })
    .from(competitionEditions)
    .where(eq(competitionEditions.id, editionId))
    .limit(1);

  const sharingStatus = editionRows[0]?.sharingStatus;
  if (!sharingStatus || !['sharing', 'closed'].includes(sharingStatus)) {
    return { allowed: false, reason: 'sharing_status_not_viewable' };
  }

  const participationRows = await db
    .select({ id: participations.id })
    .from(participations)
    .where(
      and(
        eq(participations.editionId, editionId),
        eq(participations.universityId, organizationIdHeader),
      ),
    );

  if (participationRows.length === 0) {
    return { allowed: false, reason: 'organization_not_participating' };
  }

  const hasSubmissionRows = await db
    .select({ value: sql<number>`count(*)` })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .innerJoin(submissionTemplates, eq(submissionTemplates.id, submissions.templateId))
    .where(
      and(
        eq(participations.editionId, editionId),
        eq(participations.universityId, organizationIdHeader),
        eq(submissionTemplates.id, templateId),
        eq(submissionTemplates.editionId, editionId),
      ),
    );

  if (Number(hasSubmissionRows[0]?.value ?? 0) <= 0) {
    return { allowed: false, reason: 'template_not_submitted' };
  }

  return { allowed: true };
};

export const canViewParticipationWithReason = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
  templateId?: string,
): Promise<PermissionDecision> => {
  if (await isAdmin(userId)) {
    return { allowed: true };
  }

  const participationRows = await db
    .select({
      id: participations.id,
      editionId: participations.editionId,
      universityId: participations.universityId,
    })
    .from(participations)
    .where(eq(participations.id, participationId))
    .limit(1);
  const participation = participationRows[0];
  if (!participation) {
    return { allowed: false, reason: 'participation_not_found' };
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.includes(participation.universityId)) {
    return { allowed: true };
  }

  if (!templateId) {
    return { allowed: false, reason: 'template_context_required' };
  }

  return canViewOtherSubmissionsByTemplate(
    userId,
    participation.editionId,
    templateId,
    organizationIdHeader,
  );
};

export const canViewParticipation = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
  templateId?: string,
): Promise<boolean> => {
  const decision = await canViewParticipationWithReason(
    userId,
    participationId,
    organizationIdHeader,
    templateId,
  );
  return decision.allowed;
};

export const canCommentWithReason = async (
  userId: string,
  _editionId: string,
  participationId: string,
  organizationIdHeader: string | null,
  templateId?: string,
): Promise<PermissionDecision> => {
  if (await isAdmin(userId)) {
    return { allowed: true };
  }

  return canViewParticipationWithReason(userId, participationId, organizationIdHeader, templateId);
};

export const canComment = async (
  userId: string,
  _editionId: string,
  participationId: string,
  organizationIdHeader: string | null,
  templateId?: string,
): Promise<boolean> => {
  const decision = await canCommentWithReason(
    userId,
    _editionId,
    participationId,
    organizationIdHeader,
    templateId,
  );
  return decision.allowed;
};

const getActiveCommentAuthor = async (commentId: string): Promise<string | null> => {
  const rows = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
    .limit(1);
  const comment = rows[0];
  if (!comment) {
    return null;
  }
  return comment.authorId;
};

export const canEditComment = async (userId: string, commentId: string): Promise<boolean> => {
  const authorId = await getActiveCommentAuthor(commentId);
  if (!authorId) {
    return false;
  }

  return authorId === userId;
};

export const canDeleteComment = async (userId: string, commentId: string): Promise<boolean> => {
  const authorId = await getActiveCommentAuthor(commentId);
  if (!authorId) {
    return false;
  }

  if (authorId === userId) {
    return true;
  }

  return isAdmin(userId);
};

export const canDeleteSubmission = async (
  userId: string,
  submissionId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  if (await isAdmin(userId)) {
    return true;
  }
  if (!organizationIdHeader) {
    return false;
  }

  const roleRows = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationIdHeader)))
    .limit(1);

  if (roleRows[0]?.role !== 'owner') {
    return false;
  }

  const submissionRows = await db
    .select({ universityId: participations.universityId })
    .from(submissions)
    .innerJoin(participations, eq(participations.id, submissions.participationId))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return submissionRows[0]?.universityId === organizationIdHeader;
};
