'use client';

import { RequireAuth } from '@/components/require-auth';
import { createAppApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Participation } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  params: Promise<{ id: string }>;
};

export default function AdminParticipationsPage({ params }: Props) {
  const { activeOrganizationId } = useAuth();
  const api = useMemo(() => createAppApi(() => activeOrganizationId), [activeOrganizationId]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [rows, setRows] = useState<Participation[]>([]);
  const [teamName, setTeamName] = useState('');
  const [universityId, setUniversityId] = useState('');

  useEffect(() => {
    void params.then((value) => setEditionId(value.id));
  }, [params]);

  useEffect(() => {
    if (!editionId) {
      return;
    }
    void (async () => {
      const response = await api.adminListParticipations(editionId);
      setRows(response.data);
    })();
  }, [api, editionId]);

  return (
    <RequireAuth allow={['admin']}>
      <section>
        <h1>出場登録管理</h1>
        <input
          aria-label='university-id'
          value={universityId}
          onChange={(event) => setUniversityId(event.currentTarget.value)}
          placeholder='university id'
        />
        <input
          aria-label='team-name'
          value={teamName}
          onChange={(event) => setTeamName(event.currentTarget.value)}
          placeholder='team name'
        />
        <button
          type='button'
          onClick={() => {
            if (!editionId) {
              return;
            }
            void api.adminCreateParticipation(editionId, {
              universityId,
              teamName,
            });
          }}
        >
          作成
        </button>

        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              {row.teamName ?? '名称なし'}
              <button
                type='button'
                onClick={() =>
                  void api.adminUpdateParticipation(row.id, {
                    teamName: 'updated',
                  })
                }
              >
                更新
              </button>
              <button type='button' onClick={() => void api.adminDeleteParticipation(row.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </RequireAuth>
  );
}
