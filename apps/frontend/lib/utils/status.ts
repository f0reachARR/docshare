import type { components } from '../api/schema';

export type SharingStatus =
  components['schemas'] extends Record<string, unknown>
    ? never
    : 'draft' | 'accepting' | 'sharing' | 'closed';

export const SHARING_STATUS_LABELS: Record<string, string> = {
  draft: '準備中',
  accepting: '受付中',
  sharing: '共有中',
  closed: '締切後',
};

export const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  member: 'メンバー',
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: '審査待ち',
  approved: '承認済み',
  rejected: '却下',
};
