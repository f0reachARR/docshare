import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  comments,
  competitionEditions,
  members,
  participations,
  submissionHistories,
  submissionTemplates,
  submissions,
  users,
} from '../db/schema.js';

type EditionViewAccess = {
  canAccessEdition: boolean;
  canViewComments: boolean;
  canViewAllSubmissions: boolean;
  viewableTemplateIds: Set<string>;
};

type ParticipationAccess = EditionViewAccess & {
  canViewParticipation: boolean;
  participationUniversityId: string;
  editionId: string;
};

const sharingStatusesAllowingOtherSchoolView = new Set(['sharing', 'closed']);

export const hasSubmittedAllRequiredTemplates = (params: {
  requiredTemplateIds: Iterable<string>;
  submittedTemplateIds: Iterable<string>;
}): boolean => {
  const submittedTemplateIds = new Set(params.submittedTemplateIds);

  for (const requiredTemplateId of params.requiredTemplateIds) {
    if (!submittedTemplateIds.has(requiredTemplateId)) {
      return false;
    }
  }

  return true;
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

const createDeniedEditionAccess = (): EditionViewAccess => ({
  canAccessEdition: false,
  canViewComments: false,
  canViewAllSubmissions: false,
  viewableTemplateIds: new Set<string>(),
});

const createAdminEditionAccess = async (editionId: string): Promise<EditionViewAccess> => {
  const templateRows = await db
    .select({ templateId: submissionTemplates.id })
    .from(submissionTemplates)
    .where(eq(submissionTemplates.editionId, editionId));

  return {
    canAccessEdition: true,
    canViewComments: true,
    canViewAllSubmissions: true,
    viewableTemplateIds: new Set(templateRows.map((row) => row.templateId)),
  };
};

export const getEditionViewAccess = async (
  userId: string,
  editionId: string,
  organizationIdHeader: string | null,
): Promise<EditionViewAccess> => {
  if (await isAdmin(userId)) {
    return createAdminEditionAccess(editionId);
  }

  if (!organizationIdHeader) {
    return createDeniedEditionAccess();
  }

  const universityIds = await getUserUniversityIds(userId);
  if (!universityIds.includes(organizationIdHeader)) {
    return createDeniedEditionAccess();
  }

  const editionRows = await db
    .select({ sharingStatus: competitionEditions.sharingStatus })
    .from(competitionEditions)
    .where(eq(competitionEditions.id, editionId))
    .limit(1);

  const sharingStatus = editionRows[0]?.sharingStatus;
  if (!sharingStatus || !sharingStatusesAllowingOtherSchoolView.has(sharingStatus)) {
    return createDeniedEditionAccess();
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
    return createDeniedEditionAccess();
  }

  const participationIds = participationRows.map((row) => row.id);
  const [requiredTemplateRows, submissionRows] = await Promise.all([
    db
      .select({ templateId: submissionTemplates.id })
      .from(submissionTemplates)
      .where(
        and(eq(submissionTemplates.editionId, editionId), eq(submissionTemplates.isRequired, true)),
      ),
    participationIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ templateId: submissions.templateId })
          .from(submissions)
          .where(inArray(submissions.participationId, participationIds)),
  ]);

  const canViewOtherUniversitySubmissions = hasSubmittedAllRequiredTemplates({
    requiredTemplateIds: requiredTemplateRows.map((row) => row.templateId),
    submittedTemplateIds: submissionRows.map((row) => row.templateId),
  });

  if (!canViewOtherUniversitySubmissions) {
    return createDeniedEditionAccess();
  }

  const viewableTemplateIds = new Set(submissionRows.map((row) => row.templateId));

  return {
    canAccessEdition: true,
    canViewComments: submissionRows.length > 0,
    canViewAllSubmissions: false,
    viewableTemplateIds,
  };
};

export const canViewOtherSubmissions = async (
  userId: string,
  editionId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  const access = await getEditionViewAccess(userId, editionId, organizationIdHeader);
  return access.canAccessEdition;
};

const getParticipationInfo = async (participationId: string) => {
  const rows = await db
    .select({
      id: participations.id,
      editionId: participations.editionId,
      universityId: participations.universityId,
    })
    .from(participations)
    .where(eq(participations.id, participationId))
    .limit(1);

  return rows[0] ?? null;
};

export const getParticipationAccess = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<ParticipationAccess | null> => {
  const participation = await getParticipationInfo(participationId);
  if (!participation) {
    return null;
  }

  if (await isAdmin(userId)) {
    return {
      canViewParticipation: true,
      canAccessEdition: true,
      canViewComments: true,
      canViewAllSubmissions: true,
      viewableTemplateIds: new Set<string>(),
      participationUniversityId: participation.universityId,
      editionId: participation.editionId,
    };
  }

  const universityIds = await getUserUniversityIds(userId);
  if (universityIds.includes(participation.universityId)) {
    return {
      canViewParticipation: true,
      canAccessEdition: true,
      canViewComments: true,
      canViewAllSubmissions: true,
      viewableTemplateIds: new Set<string>(),
      participationUniversityId: participation.universityId,
      editionId: participation.editionId,
    };
  }

  const editionAccess = await getEditionViewAccess(
    userId,
    participation.editionId,
    organizationIdHeader,
  );
  return {
    ...editionAccess,
    canViewParticipation: editionAccess.canAccessEdition,
    participationUniversityId: participation.universityId,
    editionId: participation.editionId,
  };
};

export const canViewParticipation = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  const access = await getParticipationAccess(userId, participationId, organizationIdHeader);
  return access?.canViewParticipation ?? false;
};

const getSubmissionInfo = async (submissionId: string) => {
  const rows = await db
    .select({
      participationId: submissions.participationId,
      templateId: submissions.templateId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return rows[0] ?? null;
};

export const canViewSubmissionByTemplate = async (
  userId: string,
  submissionId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  const submission = await getSubmissionInfo(submissionId);
  if (!submission) {
    return false;
  }

  const access = await getParticipationAccess(
    userId,
    submission.participationId,
    organizationIdHeader,
  );
  if (!access?.canViewParticipation) {
    return false;
  }

  return access.canViewAllSubmissions || access.viewableTemplateIds.has(submission.templateId);
};

const getSubmissionHistoryInfo = async (historyId: string) => {
  const rows = await db
    .select({
      participationId: submissions.participationId,
      templateId: submissions.templateId,
    })
    .from(submissionHistories)
    .innerJoin(submissions, eq(submissions.id, submissionHistories.submissionId))
    .where(eq(submissionHistories.id, historyId))
    .limit(1);

  return rows[0] ?? null;
};

export const canViewSubmissionHistoryByTemplate = async (
  userId: string,
  historyId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  const history = await getSubmissionHistoryInfo(historyId);
  if (!history) {
    return false;
  }

  const access = await getParticipationAccess(
    userId,
    history.participationId,
    organizationIdHeader,
  );
  if (!access?.canViewParticipation) {
    return false;
  }

  return access.canViewAllSubmissions || access.viewableTemplateIds.has(history.templateId);
};

export const canViewParticipationComments = async (
  userId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  const access = await getParticipationAccess(userId, participationId, organizationIdHeader);
  if (!access?.canViewParticipation) {
    return false;
  }

  return access.canViewComments;
};

export const canComment = async (
  userId: string,
  _editionId: string,
  participationId: string,
  organizationIdHeader: string | null,
): Promise<boolean> => {
  return canViewParticipationComments(userId, participationId, organizationIdHeader);
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
