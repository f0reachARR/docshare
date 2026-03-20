import { renderWithAuth } from '@/test/test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitPage from './page';

class MockXHR {
  static instances: MockXHR[] = [];

  upload = {
    addEventListener: (
      _name: string,
      callback: (event: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void,
    ) => {
      callback({ lengthComputable: true, loaded: 100, total: 100 });
    },
  };

  status = 200;

  onLoad?: () => void;

  open() {}

  setRequestHeader() {}

  addEventListener(name: string, callback: () => void) {
    if (name === 'load') {
      this.onLoad = callback;
    }
  }

  send() {
    this.onLoad?.();
  }
}

describe('/editions/:id/submit', () => {
  it('file提出の presign→PUT→登録フロー', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR as unknown as typeof XMLHttpRequest);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 't1',
              name: '動画',
              acceptType: 'file',
              allowedExtensions: ['mp4'],
              maxFileSizeMb: 100,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'p1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            presignedUrl: 'https://example.com/upload',
            s3Key: 's3/key',
            expiresIn: 300,
            templateMaxFileSizeMb: 100,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 's1' } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(<SubmitPage params={Promise.resolve({ id: 'ed1' })} />);

    const fileInput = await screen.findByLabelText('file-t1');
    const file = new File(['content'], 'movie.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/upload/presign'),
        expect.anything(),
      );
    });
  });

  it('url提出のバリデーション失敗', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 't1',
                name: '動画URL',
                acceptType: 'url',
                urlPattern: 'youtube.com',
                allowedExtensions: null,
                maxFileSizeMb: 100,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'p1' } }),
        }),
    );

    renderWithAuth(<SubmitPage params={Promise.resolve({ id: 'ed1' })} />);

    fireEvent.change(await screen.findByPlaceholderText('https://example.com/video'), {
      target: { value: 'https://vimeo.com/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'URL提出' }));

    expect(
      await screen.findByText('URL のドメインは youtube.com のいずれかである必要があります。'),
    ).toBeInTheDocument();
  });

  it('url提出のURL形式バリデーション失敗', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 't1',
                name: '動画URL',
                acceptType: 'url',
                urlPattern: 'youtube.com',
                allowedExtensions: null,
                maxFileSizeMb: 100,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'p1' } }),
        }),
    );

    renderWithAuth(<SubmitPage params={Promise.resolve({ id: 'ed1' })} />);

    fireEvent.change(await screen.findByPlaceholderText('https://example.com/video'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'URL提出' }));

    expect(await screen.findByText('有効なURL形式で入力してください。')).toBeInTheDocument();
  });

  it('既存提出差し替え時にPUT /api/submissions/:id を呼ぶ', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR as unknown as typeof XMLHttpRequest);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 't1',
              name: '動画',
              acceptType: 'file',
              allowedExtensions: ['mp4'],
              maxFileSizeMb: 100,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 's1', templateId: 't1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'p1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            presignedUrl: 'https://example.com/upload',
            s3Key: 's3/key',
            expiresIn: 300,
            templateMaxFileSizeMb: 100,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 's1' } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(<SubmitPage params={Promise.resolve({ id: 'ed1' })} />);

    const fileInput = await screen.findByLabelText('file-t1');
    const file = new File(['content'], 'movie.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/submissions/s1'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('S3アップロード後に提出登録が失敗した場合はリカバリ案内を表示', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXHR as unknown as typeof XMLHttpRequest);

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 't1',
                name: '動画',
                acceptType: 'file',
                allowedExtensions: ['mp4'],
                maxFileSizeMb: 100,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'p1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              presignedUrl: 'https://example.com/upload',
              s3Key: 's3/key',
              expiresIn: 300,
              templateMaxFileSizeMb: 100,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          statusText: 'Conflict',
          json: async () => ({
            error: 'Already exists for this template and participation',
          }),
        }),
    );

    renderWithAuth(<SubmitPage params={Promise.resolve({ id: 'ed1' })} />);

    const fileInput = await screen.findByLabelText('file-t1');
    const file = new File(['content'], 'movie.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(
      await screen.findByText(
        /ファイルはアップロード済みの可能性があるため、再試行前に再読み込みで提出状況を確認してください/,
      ),
    ).toBeInTheDocument();
  });
});
