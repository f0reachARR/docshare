import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'yyyy年MM月dd日 HH:mm', { locale: ja });
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'yyyy年MM月dd日', { locale: ja });
}
