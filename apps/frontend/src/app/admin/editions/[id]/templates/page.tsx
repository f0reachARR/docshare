'use client';

import { RequireAuth } from '@/components/require-auth';
import { createAppApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { SubmissionTemplate } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  params: Promise<{ id: string }>;
};

export default function AdminTemplatesPage({ params }: Props) {
  const { activeOrganizationId } = useAuth();
  const api = useMemo(() => createAppApi(() => activeOrganizationId), [activeOrganizationId]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [rows, setRows] = useState<SubmissionTemplate[]>([]);

  useEffect(() => {
    void params.then((value) => setEditionId(value.id));
  }, [params]);

  useEffect(() => {
    if (!editionId) {
      return;
    }
    void (async () => {
      const response = await api.getTemplates(editionId);
      setRows(response.data);
    })();
  }, [api, editionId]);

  return (
    <RequireAuth allow={['admin']}>
      <section>
        <h1>テンプレート管理</h1>
        <button
          type='button'
          onClick={() => {
            if (!editionId) {
              return;
            }
            void api.adminCreateTemplate(editionId, {
              name: '新規テンプレート',
              acceptType: 'url',
              maxFileSizeMb: 100,
            });
          }}
        >
          作成
        </button>
        <button
          type='button'
          onClick={() => {
            if (!editionId) {
              return;
            }
            void api.adminCopyTemplates(editionId, editionId);
          }}
        >
          コピー
        </button>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              {row.name}
              <button
                type='button'
                onClick={() =>
                  void api.adminUpdateTemplate(row.id, {
                    ...row,
                    name: `${row.name} 更新`,
                  })
                }
              >
                更新
              </button>
              <button type='button' onClick={() => void api.adminDeleteTemplate(row.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </RequireAuth>
  );
}
