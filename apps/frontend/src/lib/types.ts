export type Role = 'admin' | 'owner' | 'member';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export type OrganizationMembership = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
};

export type MeResponse = {
  user: AppUser;
  organizations: OrganizationMembership[];
  activeOrganizationId: string | null;
};

export type ApiResponse<T> = {
  data: T;
};

export type CompetitionSeries = {
  id: string;
  name: string;
  description: string | null;
  externalLinks: Array<{ label: string; url: string }> | null;
};

export type CompetitionEdition = {
  id: string;
  seriesId: string;
  year: number;
  name: string;
  description: string | null;
  sharingStatus: 'draft' | 'accepting' | 'sharing' | 'closed';
  externalLinks: Array<{ label: string; url: string }> | null;
  ruleDocuments: Array<{
    label: string;
    s3_key: string;
    mime_type: string;
  }> | null;
};

export type SubmissionTemplate = {
  id: string;
  editionId: string;
  name: string;
  description: string | null;
  acceptType: 'file' | 'url';
  allowedExtensions: string[] | null;
  urlPattern: string | null;
  maxFileSizeMb: number;
  isRequired: boolean;
  sortOrder: number;
};

export type Submission = {
  id: string;
  templateId: string;
  participationId: string;
  submittedBy: string;
  version: number;
  fileS3Key: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileMimeType: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionHistory = {
  id: string;
  submissionId: string;
  version: number;
  submittedBy: string;
  fileS3Key: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileMimeType: string | null;
  url: string | null;
  createdAt: string;
};

export type Participation = {
  id: string;
  editionId: string;
  universityId: string;
  teamName: string | null;
  createdAt: string;
};

export type CommentItem = {
  id: string;
  participationId: string;
  editionId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    universityName: string | null;
  };
};
