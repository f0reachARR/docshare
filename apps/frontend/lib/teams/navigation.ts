export function buildTeamDetailHref(params: {
  editionId: string;
  participationId: string;
  templateId: string;
}): string {
  const basePath = `/editions/${params.editionId}/teams/${params.participationId}`;
  return `${basePath}?templateId=${encodeURIComponent(params.templateId)}`;
}

export function hasTemplateContext(templateId: string | null | undefined): boolean {
  return Boolean(templateId);
}

export function selectViewableTemplateId(params: {
  templates: ReadonlyArray<{ id: string }>;
  cells: ReadonlyArray<{ submitted: boolean; viewable: boolean } | null | undefined>;
}): string | null {
  for (const [index, cell] of params.cells.entries()) {
    if (!cell?.submitted || !cell.viewable) {
      continue;
    }

    const templateId = params.templates[index]?.id;
    if (templateId) {
      return templateId;
    }
  }

  // No submitted-and-viewable template exists, so the caller should not link to detail.
  return null;
}
