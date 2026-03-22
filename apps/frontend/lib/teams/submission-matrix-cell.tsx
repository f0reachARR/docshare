import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Button } from '@/components/ui/button';
import {
  getDenyReasonLabel,
  getSubmissionDenyReasonLabel,
} from '@/lib/teams/submission-visibility';
import { Download, ExternalLink, Lock } from 'lucide-react';
import { useId } from 'react';

type SubmissionSummary = {
  id: string;
  fileName: string | null;
  url: string | null;
  version: number;
  updatedAt: string | Date;
};

export type SubmissionMatrixCellData = {
  submitted: boolean;
  viewable: boolean;
  denyReason: unknown;
  submission: SubmissionSummary | null;
};

const sanitizeIdPart = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

const buildDenyReasonId = ({
  instanceId,
  rowKey,
  columnKey,
  submissionId,
}: {
  instanceId: string;
  rowKey?: string;
  columnKey?: string;
  submissionId?: string | null;
}): string => {
  const parts = [
    'submission-deny-reason',
    `instance-${instanceId}`,
    submissionId ? `submission-${submissionId}` : null,
    rowKey ? `row-${rowKey}` : null,
    columnKey ? `col-${columnKey}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .map(sanitizeIdPart);

  return parts.join('-');
};

export function SubmissionMatrixCell({
  cell,
  downloadingSubmissionId,
  onDownload,
  rowKey,
  columnKey,
}: {
  cell: SubmissionMatrixCellData | null | undefined;
  downloadingSubmissionId?: string | null;
  onDownload?: (submissionId: string) => void;
  rowKey?: string;
  columnKey?: string;
}) {
  const instanceId = useId();

  if (!cell?.submitted) {
    return <span className='text-muted-foreground'>—</span>;
  }

  if (!cell.viewable || !cell.submission) {
    const reasonId = buildDenyReasonId({
      instanceId,
      rowKey,
      columnKey,
      submissionId: cell.submission?.id,
    });
    const reason = getSubmissionDenyReasonLabel({
      submitted: cell.submitted,
      viewable: cell.viewable,
      denyReason: cell.denyReason,
    });
    const reasonText =
      reason ?? getDenyReasonLabel('access_denied', '権限不足のため閲覧できません');

    return (
      <button
        type='button'
        className='rounded-md border border-dashed border-amber-400/60 bg-amber-50 px-2 py-2 text-xs text-amber-900'
        aria-live='polite'
        aria-label='閲覧不可理由'
        aria-describedby={reasonId}
        title={reasonText}
      >
        <p className='inline-flex items-center gap-1 font-medium'>
          <Lock className='h-3.5 w-3.5' aria-hidden='true' />
          閲覧不可
        </p>
        <p id={reasonId} className='mt-1'>
          {reasonText}
        </p>
      </button>
    );
  }

  const submission = cell.submission;

  return (
    <div className='space-y-1'>
      {submission.fileName ? (
        <p className='text-xs font-medium break-all'>{submission.fileName}</p>
      ) : null}
      <div className='flex items-center gap-2 flex-wrap'>
        {submission.url ? (
          <a
            href={submission.url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 text-primary hover:underline text-xs'
          >
            <ExternalLink className='h-3.5 w-3.5' />
            閲覧
          </a>
        ) : null}
        {submission.fileName ? (
          <Button
            variant='outline'
            size='xs'
            disabled={downloadingSubmissionId === submission.id}
            onClick={() => onDownload?.(submission.id)}
          >
            <Download className='h-3.5 w-3.5' />
            ダウンロード
          </Button>
        ) : null}
      </div>
      <p className='text-[11px] text-muted-foreground'>
        v{submission.version} <DateTimeDisplay value={String(submission.updatedAt)} />
      </p>
    </div>
  );
}
