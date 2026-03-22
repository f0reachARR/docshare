export function buildTeamDetailHref(params: {
  editionId: string;
  participationId: string;
  templateId: string | null | undefined;
}): string {
  const basePath = `/editions/${params.editionId}/teams/${params.participationId}`;
  if (!params.templateId) {
    return basePath;
  }

  return `${basePath}?templateId=${encodeURIComponent(params.templateId)}`;
}

export function hasTemplateContext(templateId: string | null | undefined): boolean {
  return Boolean(templateId);
}
