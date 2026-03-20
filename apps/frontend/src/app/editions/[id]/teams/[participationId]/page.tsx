'use client';

import { ErrorPanel } from '@/components/error-panel';
import { RequireAuth } from '@/components/require-auth';
import { createAppApi } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { CommentItem } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type Props = {
  params: Promise<{ id: string; participationId: string }>;
};

export default function TeamDetailPage({ params }: Props) {
  const { activeOrganizationId, user } = useAuth();
  const api = useMemo(() => createAppApi(() => activeOrganizationId), [activeOrganizationId]);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [participationId, setParticipationId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<
    Array<{
      id: string;
      fileName: string | null;
      url: string | null;
      version: number;
    }>
  >([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((value) => {
      setEditionId(value.id);
      setParticipationId(value.participationId);
    });
  }, [params]);

  const load = useCallback(async () => {
    if (!editionId || !participationId) {
      return;
    }

    try {
      setError(null);
      const [submissionResponse, commentResponse] = await Promise.all([
        api.listEditionSubmissions(editionId),
        api.listComments(participationId),
      ]);

      setSubmissions(
        submissionResponse.data
          .filter((row) => row.participation.id === participationId)
          .map((row) => row.submission),
      );
      setComments(commentResponse.data);
    } catch {
      setError('チーム詳細の取得に失敗しました。');
    }
  }, [api, editionId, participationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitComment = async () => {
    if (!participationId || !draft) {
      return;
    }

    try {
      await api.createComment(participationId, draft);
      setDraft('');
      await load();
    } catch {
      setError('コメント投稿に失敗しました。');
    }
  };

  const editComment = async (commentId: string) => {
    const nextBody = window.prompt(
      'コメントを編集',
      comments.find((item) => item.id === commentId)?.body,
    );
    if (!nextBody) {
      return;
    }
    await api.updateComment(commentId, nextBody);
    await load();
  };

  const deleteComment = async (commentId: string) => {
    await api.deleteComment(commentId);
    await load();
  };

  const downloadSubmission = async (submissionId: string) => {
    try {
      setDownloadingSubmissionId(submissionId);
      setDownloadError(null);
      const response = await api.getSubmissionDownload(submissionId);
      window.open(response.data.url, '_blank', 'noopener,noreferrer');
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setDownloadError(`最新版ダウンロードに失敗しました（${errorValue.message}）。`);
      } else {
        setDownloadError('最新版ダウンロードに失敗しました。');
      }
    } finally {
      setDownloadingSubmissionId(null);
    }
  };

  return (
    <RequireAuth>
      <section>
        <h1>チーム詳細</h1>
        {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
        {downloadError ? <ErrorPanel message={downloadError} /> : null}
        <h2>提出資料</h2>
        <p>最新版は「最新版DL」、過去バージョンは「履歴（過去版DL）」から取得できます。</p>
        <ul>
          {submissions.map((submission) => (
            <li key={submission.id}>
              {submission.fileName ?? submission.url ?? '提出内容'} (v
              {submission.version}){' '}
              {submission.fileName ? (
                <button
                  type='button'
                  onClick={() => void downloadSubmission(submission.id)}
                  disabled={downloadingSubmissionId === submission.id}
                >
                  最新版DL
                </button>
              ) : (
                <a href={submission.url ?? '#'} target='_blank' rel='noreferrer'>
                  URLを開く
                </a>
              )}{' '}
              <Link href={`/editions/${editionId}/submissions/${submission.id}/history`}>
                履歴（過去版DL）
              </Link>
            </li>
          ))}
        </ul>

        <h2>コメント</h2>
        <ul>
          {comments.map((comment) => (
            <li key={comment.id}>
              <p>
                {comment.author.universityName ?? '大学未設定'} / {comment.author.name}
              </p>
              <ReactMarkdown>{comment.body}</ReactMarkdown>
              {user?.id === comment.author.id ? (
                <>
                  <button type='button' onClick={() => void editComment(comment.id)}>
                    編集
                  </button>
                  <button type='button' onClick={() => void deleteComment(comment.id)}>
                    削除
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>

        <textarea
          aria-label='comment-input'
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <button type='button' onClick={() => void submitComment()}>
          投稿
        </button>
      </section>
    </RequireAuth>
  );
}
