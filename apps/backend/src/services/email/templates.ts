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

const emailTemplateDefinitions: {
  [TemplateId in EmailTemplateId]: EmailTemplateDefinition<TemplateId>;
} = {
  'organization-invitation': {
    render: (payload) => ({
      subject: `${payload.organizationName} への招待`,
      html: `${payload.inviterName} さんが ${payload.organizationName} へ招待しました: ${payload.inviteLink}`,
    }),
  },
  'organization-member-invitation-link': {
    render: (payload) => ({
      subject: `${payload.organizationName} への招待`,
      html: `招待リンク: ${payload.invitationLink}`,
    }),
  },
  'university-owner-invitation-link': {
    render: (payload) => ({
      subject: `${payload.universityName} の代表者招待`,
      html: `招待リンク: ${payload.invitationLink}`,
    }),
  },
  'university-owner-invitation-id': {
    render: (payload) => ({
      subject: `${payload.universityName} の代表者招待`,
      html: `招待ID: ${payload.invitationId}`,
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
