import { describe, expect, it } from 'vitest';
import { buildTeamDetailHref, hasTemplateContext } from './navigation';

describe('team detail navigation', () => {
  it('templateId がある場合は teams 詳細リンクに query を付与する', () => {
    const href = buildTeamDetailHref({
      editionId: 'ed-1',
      participationId: 'part-1',
      templateId: 'tpl-1',
    });

    expect(href).toBe('/editions/ed-1/teams/part-1?templateId=tpl-1');
  });

  it('templateId がない場合は query を付与しない', () => {
    const href = buildTeamDetailHref({
      editionId: 'ed-1',
      participationId: 'part-1',
      templateId: null,
    });

    expect(href).toBe('/editions/ed-1/teams/part-1');
  });

  it('template context の有無判定', () => {
    expect(hasTemplateContext('tpl-1')).toBe(true);
    expect(hasTemplateContext('')).toBe(false);
    expect(hasTemplateContext(undefined)).toBe(false);
  });
});
