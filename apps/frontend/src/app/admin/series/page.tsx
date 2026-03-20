'use client';

import { ErrorPanel } from '@/components/error-panel';
import { RequireAuth } from '@/components/require-auth';
import { createAppApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { CompetitionSeries } from '@/lib/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function AdminSeriesPage() {
  const { activeOrganizationId } = useAuth();
  const api = useMemo(() => createAppApi(() => activeOrganizationId), [activeOrganizationId]);
  const [rows, setRows] = useState<CompetitionSeries[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.listSeries();
      setRows(response.data);
      setError(null);
    } catch {
      setError('シリーズ一覧を取得できません。');
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      await api.adminCreateSeries({ name });
      setName('');
      await load();
    } catch {
      setError('作成に失敗しました。');
    }
  };

  return (
    <RequireAuth allow={['admin']}>
      <section>
        <h1>大会シリーズ管理</h1>
        {error ? <ErrorPanel message={error} /> : null}
        <input value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <button type='button' onClick={() => void create()}>
          作成
        </button>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              {row.name}
              <button
                type='button'
                onClick={() =>
                  void api.adminUpdateSeries(row.id, {
                    name: `${row.name} updated`,
                  })
                }
              >
                更新
              </button>
              <button type='button' onClick={() => void api.adminDeleteSeries(row.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </RequireAuth>
  );
}
