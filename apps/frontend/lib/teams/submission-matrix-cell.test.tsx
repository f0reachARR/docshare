import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmissionMatrixCell, type SubmissionMatrixCellData } from './submission-matrix-cell';

const buildCell = (overrides: Partial<SubmissionMatrixCellData>): SubmissionMatrixCellData => {
  return {
    submitted: true,
    viewable: true,
    denyReason: null,
    submission: {
      id: 'sub-1',
      fileName: 'proposal.pdf',
      url: null,
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
};

describe('SubmissionMatrixCell', () => {
  afterEach(() => {
    cleanup();
  });

  it('未提出の場合はダッシュを表示する', () => {
    render(<SubmissionMatrixCell cell={buildCell({ submitted: false, submission: null })} />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('ダウンロード')).toBeNull();
  });

  it('提出済みかつ閲覧可能な場合は提出情報を表示する', () => {
    const onDownload = vi.fn();

    render(
      <SubmissionMatrixCell
        cell={buildCell({
          viewable: true,
          submission: {
            id: 'sub-2',
            fileName: 'robot-design.pdf',
            url: null,
            version: 3,
            updatedAt: '2026-02-02T10:00:00.000Z',
          },
        })}
        onDownload={onDownload}
      />,
    );

    expect(screen.getByText('robot-design.pdf')).toBeTruthy();
    const downloadButton = screen.getByRole('button', { name: 'ダウンロード' });
    expect(downloadButton).toBeTruthy();

    downloadButton.click();
    expect(onDownload).toHaveBeenCalledWith('sub-2');
  });

  it('提出済みだが閲覧不可の場合は理由を表示する', () => {
    render(
      <SubmissionMatrixCell
        cell={buildCell({
          viewable: false,
          denyReason: 'context_required',
          submission: {
            id: 'sub-3',
            fileName: 'confidential.pdf',
            url: null,
            version: 1,
            updatedAt: '2026-03-03T00:00:00.000Z',
          },
        })}
      />,
    );

    expect(screen.getByText('閲覧不可')).toBeTruthy();
    const reasonText = '資料種別または所属大学を指定して閲覧してください';
    expect(screen.getByText(reasonText)).toBeTruthy();

    const reasonElement = screen.getByRole('button', { name: '閲覧不可理由' });
    expect(reasonElement.getAttribute('title')).toBe(reasonText);
  });

  it('閲覧不可理由は title ツールチップ追加後も常時テキスト導線として表示される', () => {
    render(
      <SubmissionMatrixCell
        cell={buildCell({
          viewable: false,
          denyReason: 'access_denied',
          submission: {
            id: 'sub-5',
            fileName: 'private.pdf',
            url: null,
            version: 1,
            updatedAt: '2026-03-10T00:00:00.000Z',
          },
        })}
      />,
    );

    const reasonText = '権限不足のため閲覧できません';
    const reasonElement = screen.getByRole('button', { name: '閲覧不可理由' });

    expect(reasonElement).toBeTruthy();
    expect(screen.getByText(reasonText)).toBeTruthy();
    expect(reasonElement.getAttribute('title')).toBe(reasonText);
  });

  it('閲覧不可理由がキーボード操作で到達可能', async () => {
    const user = userEvent.setup();

    render(
      <SubmissionMatrixCell
        cell={buildCell({
          viewable: false,
          denyReason: 'access_denied',
          submission: {
            id: 'sub-4',
            fileName: 'locked.pdf',
            url: null,
            version: 1,
            updatedAt: '2026-03-10T00:00:00.000Z',
          },
        })}
      />,
    );

    const reasonElement = screen.getByRole('button', { name: '閲覧不可理由' });
    await user.tab();

    expect(document.activeElement).toBe(reasonElement);
  });

  it('submission が null の複数ロックセルでも理由テキスト id が衝突しない', () => {
    render(
      <>
        <SubmissionMatrixCell
          cell={buildCell({
            viewable: false,
            denyReason: 'context_required',
            submission: null,
          })}
        />
        <SubmissionMatrixCell
          cell={buildCell({
            viewable: false,
            denyReason: 'context_required',
            submission: null,
          })}
        />
      </>,
    );

    const reasonButtons = screen.getAllByRole('button', { name: '閲覧不可理由' });
    expect(reasonButtons).toHaveLength(2);

    const firstReasonId = reasonButtons[0].getAttribute('aria-describedby');
    const secondReasonId = reasonButtons[1].getAttribute('aria-describedby');

    expect(firstReasonId).toBeTruthy();
    expect(secondReasonId).toBeTruthy();
    expect(firstReasonId).not.toBe(secondReasonId);

    expect(document.getElementById(firstReasonId ?? '')).toBeTruthy();
    expect(document.getElementById(secondReasonId ?? '')).toBeTruthy();
  });

  it('row/column context を渡した場合も aria-describedby 参照先が一意', () => {
    render(
      <>
        <SubmissionMatrixCell
          cell={buildCell({
            viewable: false,
            denyReason: 'context_required',
            submission: null,
          })}
          rowKey='team-a'
          columnKey='desktop-tpl-1'
        />
        <SubmissionMatrixCell
          cell={buildCell({
            viewable: false,
            denyReason: 'context_required',
            submission: null,
          })}
          rowKey='team-b'
          columnKey='desktop-tpl-1'
        />
      </>,
    );

    const reasonButtons = screen.getAllByRole('button', { name: '閲覧不可理由' });
    const firstReasonId = reasonButtons[0].getAttribute('aria-describedby');
    const secondReasonId = reasonButtons[1].getAttribute('aria-describedby');

    expect(firstReasonId).toBeTruthy();
    expect(secondReasonId).toBeTruthy();
    expect(firstReasonId).not.toBe(secondReasonId);
  });
});
