export interface FileValidationResult {
  ok: boolean;
  message?: string;
}

export function validateFile(
  file: File,
  template: { allowedExtensions: string[] | null; maxFileSizeMb: number },
): FileValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (template.allowedExtensions && template.allowedExtensions.length > 0) {
    if (!ext || !template.allowedExtensions.includes(ext)) {
      return {
        ok: false,
        message: `許可された拡張子: ${template.allowedExtensions.join(', ')}`,
      };
    }
  }

  const maxBytes = template.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `ファイルサイズは ${template.maxFileSizeMb}MB 以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
    };
  }

  return { ok: true };
}

export function s3Put(
  presignedUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3アップロードに失敗しました (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('ネットワークエラーが発生しました'));
    });

    xhr.send(file);
  });
}
