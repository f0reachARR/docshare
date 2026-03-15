import { extname } from 'node:path';

type TemplateLike = {
  acceptType: 'file' | 'url';
  allowedExtensions: string[] | null;
  maxFileSizeMb: number;
  urlPattern: string | null;
};

type SubmissionPayload = {
  s3Key?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  url?: string;
};

type ValidationResult = { ok: true } | { ok: false; error: string };

const getExtension = (fileName: string): string | null => {
  const ext = extname(fileName).slice(1).toLowerCase();
  return ext.length > 0 ? ext : null;
};

const hasFileFields = (payload: SubmissionPayload): boolean => {
  return Boolean(payload.s3Key || payload.fileName || payload.fileSizeBytes || payload.mimeType);
};

const validateUrlPattern = (url: string, pattern: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const trimmed = pattern.trim();
  if (!trimmed) {
    return true;
  }

  // `/.../` 形式は正規表現として扱う
  if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length >= 2) {
    try {
      const regex = new RegExp(trimmed.slice(1, -1), 'i');
      return regex.test(url);
    } catch {
      return false;
    }
  }

  // `youtube.com, youtu.be` のような列挙をホスト名サフィックス一致で扱う
  const candidates = trimmed
    .split(/[\s,]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  if (candidates.length === 0) {
    return true;
  }

  const host = parsed.hostname.toLowerCase();
  return candidates.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
};

export const isSubmissionMutableStatus = (
  sharingStatus: 'draft' | 'accepting' | 'sharing' | 'closed',
): boolean => {
  return sharingStatus === 'accepting' || sharingStatus === 'sharing';
};

export const validateSubmissionPayload = (
  template: TemplateLike,
  payload: SubmissionPayload,
): ValidationResult => {
  if (template.acceptType === 'file') {
    if (payload.url) {
      return { ok: false, error: 'File template does not accept url field' };
    }

    if (!payload.s3Key || !payload.fileName || !payload.fileSizeBytes || !payload.mimeType) {
      return { ok: false, error: 'Missing file fields for file template' };
    }

    if (payload.fileSizeBytes > template.maxFileSizeMb * 1024 * 1024) {
      return { ok: false, error: 'File exceeds template max size' };
    }

    if (template.allowedExtensions?.length) {
      const ext = getExtension(payload.fileName);
      if (!ext) {
        return { ok: false, error: 'File extension is required' };
      }

      const allowed = template.allowedExtensions.map((value) => value.toLowerCase());
      if (!allowed.includes(ext)) {
        return { ok: false, error: 'Disallowed file extension' };
      }
    }

    return { ok: true };
  }

  if (!payload.url) {
    return { ok: false, error: 'URL is required for url template' };
  }

  if (hasFileFields(payload)) {
    return { ok: false, error: 'URL template does not accept file fields' };
  }

  if (template.urlPattern && !validateUrlPattern(payload.url, template.urlPattern)) {
    return { ok: false, error: 'URL does not match template urlPattern' };
  }

  return { ok: true };
};

export const isContentTypeConsistent = (fileName: string, contentType: string): boolean => {
  const ext = getExtension(fileName);
  if (!ext) {
    return true;
  }

  const mime = contentType.toLowerCase();
  const map: Record<string, string[]> = {
    pdf: ['application/pdf'],
    ppt: ['application/vnd.ms-powerpoint'],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    doc: ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    xls: ['application/vnd.ms-excel'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    txt: ['text/plain'],
    zip: ['application/zip'],
    mp4: ['video/mp4'],
    mov: ['video/quicktime'],
    webm: ['video/webm'],
  };

  const accepted = map[ext];
  if (!accepted) {
    return true;
  }

  return accepted.includes(mime);
};
