import type {
  EmailTemplateId,
  EmailTemplateMap,
  SendEmailContentParams,
  SendEmailParams,
  SendEmailTemplateParams,
} from './interface.js';

type EmailTemplateDefinition<TemplateId extends EmailTemplateId> = {
  render: (payload: EmailTemplateMap[TemplateId]) => Omit<SendEmailContentParams, 'to'>;
};

type EmailTemplateContent = {
  subject: string;
  heading: string;
  body: string[];
  action?: {
    label: string;
    href: string;
  };
  detail?: {
    label: string;
    value: string;
  };
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });

const renderParagraphs = (paragraphs: string[]): string =>
  paragraphs
    .map((paragraph) => `<p style="margin: 0 0 16px;">${escapeHtml(paragraph)}</p>`)
    .join('');

const renderEmail = (content: EmailTemplateContent): Omit<SendEmailContentParams, 'to'> => {
  const detailText = content.detail
    ? `${content.detail.label}: ${content.detail.value}`
    : undefined;
  const actionText = content.action ? `${content.action.label}: ${content.action.href}` : undefined;
  const text = [
    content.heading,
    '',
    ...content.body,
    ...(detailText ? ['', detailText] : []),
    ...(actionText ? ['', actionText] : []),
    '',
    'このメールに心当たりがない場合は、破棄してください。',
    '',
    'DocShare',
  ].join('\n');

  const detailHtml = content.detail
    ? `<div style="margin: 20px 0; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">${escapeHtml(content.detail.label)}</div>
        <div style="font-size: 16px; color: #0f172a; font-weight: 600; word-break: break-all;">${escapeHtml(content.detail.value)}</div>
      </div>`
    : '';
  const actionHtml = content.action
    ? `<div style="margin: 24px 0;">
        <a href="${escapeHtml(content.action.href)}" style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">${escapeHtml(content.action.label)}</a>
      </div>
      <p style="margin: 0 0 16px; color: #475569; font-size: 13px; word-break: break-all;">ボタンを開けない場合は、次のURLをブラウザに貼り付けてください。<br>${escapeHtml(content.action.href)}</p>`
    : '';

  return {
    subject: content.subject,
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.7;">
      <h1 style="font-size: 20px; line-height: 1.4; margin: 0 0 20px;">${escapeHtml(content.heading)}</h1>
      ${renderParagraphs(content.body)}
      ${detailHtml}
      ${actionHtml}
      <p style="margin: 24px 0 0; color: #475569; font-size: 13px;">このメールに心当たりがない場合は、破棄してください。</p>
      <p style="margin: 24px 0 0;">DocShare</p>
    </div>`,
    text,
  };
};

const emailTemplateDefinitions: {
  [TemplateId in EmailTemplateId]: EmailTemplateDefinition<TemplateId>;
} = {
  'organization-invitation': {
    render: (payload) =>
      renderEmail({
        subject: `${payload.organizationName} への招待`,
        heading: `${payload.organizationName} への招待`,
        body: [
          `${payload.inviterName} さんから、DocShare の ${payload.organizationName} に参加するための招待が届いています。`,
          '以下のリンクから参加手続きを完了してください。',
        ],
        action: {
          label: '招待を確認する',
          href: payload.inviteLink,
        },
      }),
  },
  'organization-member-invitation-link': {
    render: (payload) =>
      renderEmail({
        subject: `${payload.organizationName} への招待`,
        heading: `${payload.organizationName} への招待`,
        body: [
          `DocShare の ${payload.organizationName} にメンバーとして参加するための招待リンクをお送りします。`,
          '以下のリンクからアカウントの確認または登録を進めてください。',
        ],
        action: {
          label: 'メンバー招待を開く',
          href: payload.invitationLink,
        },
      }),
  },
  'university-owner-invitation-link': {
    render: (payload) =>
      renderEmail({
        subject: `${payload.universityName} の代表者招待`,
        heading: `${payload.universityName} の代表者招待`,
        body: [
          `DocShare で ${payload.universityName} の代表者アカウントを設定するための招待リンクをお送りします。`,
          '以下のリンクから代表者アカウントの設定を完了してください。',
        ],
        action: {
          label: '代表者設定を開く',
          href: payload.invitationLink,
        },
      }),
  },
  'university-owner-invitation-id': {
    render: (payload) =>
      renderEmail({
        subject: `${payload.universityName} の代表者招待`,
        heading: `${payload.universityName} の代表者招待`,
        body: [
          `DocShare で ${payload.universityName} の代表者アカウントを設定するための招待IDをお送りします。`,
          'DocShare の画面で招待IDを入力し、代表者アカウントの設定を完了してください。',
        ],
        detail: {
          label: '招待ID',
          value: payload.invitationId,
        },
      }),
  },
};

export const resolveEmailTemplate = <TemplateId extends EmailTemplateId>(
  template: TemplateId,
  payload: EmailTemplateMap[TemplateId],
): Omit<SendEmailContentParams, 'to'> => emailTemplateDefinitions[template].render(payload);

const isTemplateEmail = (params: SendEmailParams): params is SendEmailTemplateParams =>
  'template' in params;

export const resolveSendEmailParams = (params: SendEmailParams): SendEmailContentParams => {
  if (!isTemplateEmail(params)) {
    return params;
  }

  return {
    to: params.to,
    text: params.text,
    ...resolveEmailTemplate(params.template, params.payload),
  };
};
