import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  comments,
  competitionEditions,
  members,
  participations,
  submissions,
  users,
} from "../db/schema";

export const isAdmin = async (userId: string): Promise<boolean> => {
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.isAdmin ?? false;
};

export const getUserUniversityIds = async (
  userId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, userId));
  return rows.map((row) => row.organizationId);
};

export const hasAnySubmission = async (
  universityId: string,
  editionId: string,
): Promise<boolean> => {
  const result = await db
    .select({ value: sql<number>`count(*)` })
    .from(participations)
    .innerJoin(submissions, eq(submissions.participationId, participations.id))
    .where(
      and(
        eq(participations.universityId, universityId),
        eq(participations.editionId, editionId),
      ),
    );

  return Number(result[0]?.value ?? 0) > 0;
};

export const canViewOtherSubmissions = async (
  userId: string,
  editionId: string,
): Promise<boolean> => {
  if (await isAdmin(userId)) {
    return true;
  }

  const editionRows = await db
    .select({ sharingStatus: competitionEditions.sharingStatus })
    .from(competitionEditions)
    .where(eq(competitionEditions.id, editionId))
    .limit(1);

  const sharingStatus = editionRows[0]?.sharingStatus;
  if (!sharingStatus || !["sharing", "closed"].includes(sharingStatus)) {
    return false;
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.length === 0) {
    return false;
  }

  for (const universityId of universityIds) {
    if (await hasAnySubmission(universityId, editionId)) {
      return true;
    }
  }

  return false;
};

export const canViewParticipation = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  if (await isAdmin(userId)) {
    return true;
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
    return false;
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.includes(participation.universityId)) {
    return true;
  }

  if (!organizationIdHeader || !universityIds.includes(organizationIdHeader)) {
    return false;
  }

  return canViewOtherSubmissions(userId, participation.editionId);
};

export const canComment = async (
  userId: string,
  _editionId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  if (await isAdmin(userId)) {
    return true;
  }

  return canViewParticipation(userId, participationId, organizationIdHeader);
};

const getActiveCommentAuthor = async (
  commentId: string,
): Promise<string | null> => {
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

export const canEditComment = async (
  userId: string,
  commentId: string,
): Promise<boolean> => {
  const authorId = await getActiveCommentAuthor(commentId);
  if (!authorId) {
    return false;
  }

  return authorId === userId;
};

export const canDeleteComment = async (
  userId: string,
  commentId: string,
): Promise<boolean> => {
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
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationIdHeader),
      ),
    )
    .limit(1);

  if (roleRows[0]?.role !== "owner") {
    return false;
  }

  const submissionRows = await db
    .select({ universityId: participations.universityId })
    .from(submissions)
    .innerJoin(
      participations,
      eq(participations.id, submissions.participationId),
    )
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return submissionRows[0]?.universityId === organizationIdHeader;
};
