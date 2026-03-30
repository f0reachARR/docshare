export type TemplateAcceptType = 'file' | 'url';

export type Template = {
  id: string;
  name: string;
  description: string | null;
  acceptType: TemplateAcceptType;
  allowedExtensions: string[] | null;
  urlPattern: string | null;
  maxFileSizeMb: number;
  isRequired: boolean;
  sortOrder: number;
  createdAt: unknown;
};

export type TemplateFormValues = {
  name: string;
  description: string;
  acceptType: TemplateAcceptType;
  allowedExtensions: string;
  urlPattern: string;
  maxFileSizeMb: number;
  isRequired: boolean;
  sortOrder: number;
};
