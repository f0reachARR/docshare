import { describe, expect, it } from 'vitest';
import { hasSubmittedAllRequiredTemplates } from './permissions.js';

describe('hasSubmittedAllRequiredTemplates', () => {
  it('returns true when there are no required templates', () => {
    expect(
      hasSubmittedAllRequiredTemplates({
        requiredTemplateIds: [],
        submittedTemplateIds: [],
      }),
    ).toBe(true);
  });

  it('returns true when all required templates are submitted', () => {
    expect(
      hasSubmittedAllRequiredTemplates({
        requiredTemplateIds: ['tpl-1', 'tpl-2'],
        submittedTemplateIds: ['tpl-2', 'tpl-1', 'tpl-3'],
      }),
    ).toBe(true);
  });

  it('returns false when any required template is missing', () => {
    expect(
      hasSubmittedAllRequiredTemplates({
        requiredTemplateIds: ['tpl-1', 'tpl-2'],
        submittedTemplateIds: ['tpl-1'],
      }),
    ).toBe(false);
  });
});
