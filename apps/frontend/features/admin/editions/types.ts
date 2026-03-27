export type SharingStatus = 'draft' | 'accepting' | 'sharing' | 'closed';

export const SHARING_STATUS_LABELS: Record<SharingStatus, string> = {
  draft: '準備中',
  accepting: '受付中',
  sharing: '共有中',
  closed: '締切後',
};

export type EditionRuleDocument = {
  label: string;
  s3_key: string;
  mime_type: string;
  url: string;
};

export type Edition = {
  id: string;
  seriesId: string;
  year: number;
  name: string;
  description: string | null;
  ruleDocuments: EditionRuleDocument[] | null;
  sharingStatus: SharingStatus;
  externalLinks: { label: string; url: string }[] | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ExternalLink = { label: string; url: string };

export type AdminEditionsQueryParams = {
  page: number;
  pageSize: number;
  q: string;
};

export type EditionFormValues = {
  seriesId: string;
  year: number;
  name: string;
  description: string;
  sharingStatus: SharingStatus;
};
