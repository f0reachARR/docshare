import { describe, expect, it } from 'vitest';
import { buildTeamDetailHref, hasTemplateContext, selectViewableTemplateId } from './navigation';

describe('team detail navigation', () => {
  it('templateId がある場合は teams 詳細リンクに query を付与する', () => {
    const href = buildTeamDetailHref({
      editionId: 'ed-1',
      participationId: 'part-1',
      templateId: 'tpl-1',
    });

    expect(href).toBe('/editions/ed-1/teams/part-1?templateId=tpl-1');
  });

  it('templateId は URL エンコードして query を付与する', () => {
    const href = buildTeamDetailHref({
      editionId: 'ed-1',
      participationId: 'part-1',
      templateId: 'tpl id',
    });

    expect(href).toBe('/editions/ed-1/teams/part-1?templateId=tpl%20id');
  });

  it('template context の有無判定', () => {
    expect(hasTemplateContext('tpl-1')).toBe(true);
    expect(hasTemplateContext('')).toBe(false);
    expect(hasTemplateContext(undefined)).toBe(false);
  });

  it('閲覧可能セルが複数ある場合は左から最初の templateId を選ぶ', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }, { id: 'tpl-3' }],
      cells: [{ viewable: false }, { viewable: true }, { viewable: true }],
    });

    expect(templateId).toBe('tpl-2');
  });

  it('全セル閲覧不可なら null を返す', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
      cells: [{ viewable: false }, { viewable: false }],
    });

    expect(templateId).toBeNull();
  });

  it('template と cell の長さが不一致でも安全に判定する', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }],
      cells: [{ viewable: false }, { viewable: true }],
    });

    expect(templateId).toBeNull();
  });
});
