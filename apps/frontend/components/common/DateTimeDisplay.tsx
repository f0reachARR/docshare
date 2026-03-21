import { formatDate, formatDateTime } from '@/lib/utils/date';

export function DateTimeDisplay({
  value,
  dateOnly = false,
}: {
  value: string | Date | null | undefined;
  dateOnly?: boolean;
}) {
  return (
    <time dateTime={value ? new Date(value).toISOString() : undefined}>
      {dateOnly ? formatDate(value) : formatDateTime(value)}
    </time>
  );
}
