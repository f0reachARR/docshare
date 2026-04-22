export type EmailTemplateMap = {
  'organization-invitation': {
    organizationName: string;
    inviterName: string;
    inviteLink: string;
  };
  'organization-member-invitation-link': {
    organizationName: string;
    invitationLink: string;
  };
  'university-owner-invitation-link': {
    universityName: string;
    invitationLink: string;
  };
  'university-owner-invitation-id': {
    universityName: string;
    invitationId: string;
  };
};

export type EmailTemplateId = keyof EmailTemplateMap;

export type SendEmailContentParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: never;
  payload?: never;
};

export type SendEmailTemplateParams = {
  [TemplateId in EmailTemplateId]: {
    to: string;
    template: TemplateId;
    payload: EmailTemplateMap[TemplateId];
    text?: string;
    subject?: never;
    html?: never;
  };
}[EmailTemplateId];

export type SendEmailParams = SendEmailContentParams | SendEmailTemplateParams;

export type SendEmailResult = {
  success: boolean;
  messageId?: string;
};

export interface EmailService {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
