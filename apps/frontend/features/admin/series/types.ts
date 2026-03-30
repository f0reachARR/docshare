export type Series = {
  id: string;
  name: string;
  description: string | null;
  externalLinks: { label: string; url: string }[] | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ExternalLink = { label: string; url: string };

export type AdminSeriesQueryParams = {
  page: number;
  pageSize: number;
  q: string;
};

export type SeriesFormValues = {
  name: string;
  description: string;
};
