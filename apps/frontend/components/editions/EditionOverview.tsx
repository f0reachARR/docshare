'use client';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { paths } from '@/lib/api/schema';
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type EditionDetail =
  paths['/api/editions/{id}']['get']['responses'][200]['content']['application/json']['data'];

export function EditionOverview({
  edition,
  actions,
}: {
  edition: EditionDetail;
  actions?: ReactNode;
}) {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <div className='flex items-center gap-3 flex-wrap'>
          <h1 className='text-2xl font-bold'>
            {edition.year}年 {edition.name}
          </h1>
          <StatusBadge status={edition.sharingStatus} />
        </div>
        {edition.description ? (
          <p className='text-muted-foreground'>{edition.description}</p>
        ) : null}
      </div>

      {edition.ruleDocuments && edition.ruleDocuments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ルール資料</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {edition.ruleDocuments.map((doc) => (
              <a
                key={doc.s3_key}
                href={doc.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <FileTextIcon className='h-4 w-4' />
                {doc.label}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {edition.externalLinks && edition.externalLinks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>外部リンク</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {edition.externalLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <ExternalLinkIcon className='h-4 w-4' />
                {link.label}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {actions ? <div className='flex gap-3 flex-wrap'>{actions}</div> : null}
    </div>
  );
}
