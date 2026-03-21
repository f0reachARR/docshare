import { Badge } from '@/components/ui/badge';
import { SHARING_STATUS_LABELS } from '@/lib/utils/status';

type SharingStatus = 'draft' | 'accepting' | 'sharing' | 'closed';

const STATUS_VARIANTS: Record<SharingStatus, 'secondary' | 'default' | 'outline' | 'destructive'> =
  {
    draft: 'secondary',
    accepting: 'default',
    sharing: 'outline',
    closed: 'destructive',
  };

export function StatusBadge({ status }: { status: SharingStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{SHARING_STATUS_LABELS[status] ?? status}</Badge>;
}
