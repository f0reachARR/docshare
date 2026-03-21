import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-center gap-3'>
      <InboxIcon className='h-10 w-10 text-muted-foreground' />
      <div>
        <p className='text-base font-medium text-foreground'>{title}</p>
        {description && <p className='text-sm text-muted-foreground mt-1'>{description}</p>}
      </div>
      {action}
    </div>
  );
}
