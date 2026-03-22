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

  it('submitted && viewable のセルが複数ある場合は左から最初の templateId を選ぶ', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }, { id: 'tpl-3' }],
      cells: [
        { submitted: false, viewable: true },
        { submitted: true, viewable: true },
        { submitted: true, viewable: true },
      ],
    });

    expect(templateId).toBe('tpl-2');
  });

  it('viewable=true かつ submitted=false のみなら null を返す', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
      cells: [
        { submitted: false, viewable: true },
        { submitted: false, viewable: false },
      ],
    });

    expect(templateId).toBeNull();
  });

  it('先行する viewable のみセルをスキップし後続の submitted && viewable を選ぶ', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }, { id: 'tpl-3' }],
      cells: [
        { submitted: false, viewable: true },
        { submitted: false, viewable: false },
        { submitted: true, viewable: true },
      ],
    });

    expect(templateId).toBe('tpl-3');
  });

  it('全セルが submitted && viewable を満たさないなら null を返す', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
      cells: [
        { submitted: true, viewable: false },
        { submitted: false, viewable: false },
      ],
    });

    expect(templateId).toBeNull();
  });

  it('template と cell の長さが不一致でも安全に判定する', () => {
    const templateId = selectViewableTemplateId({
      templates: [{ id: 'tpl-1' }],
      cells: [
        { submitted: false, viewable: false },
        { submitted: true, viewable: true },
      ],
    });

    expect(templateId).toBeNull();
  });
});
