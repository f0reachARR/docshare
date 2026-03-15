import { describe, expect, it } from 'vitest';
import { buildRuleKey, buildVersionedSubmissionKey } from './storage.js';

describe('storage key builders', () => {
  it('builds versioned submission key with v prefix', () => {
    const key = buildVersionedSubmissionKey({
      editionId: 'edition-1',
      participationId: 'part-1',
      templateId: 'tpl-1',
      version: 3,
      fileName: 'my file.pdf',
    });

    expect(key).toContain('submissions/edition-1/part-1/tpl-1/v3_');
    expect(key.endsWith('_my_file.pdf')).toBe(true);
  });

  it('builds rule key', () => {
    const key = buildRuleKey('ed-1', 'rule doc.pdf');
    expect(key).toContain('rules/ed-1/');
    expect(key.endsWith('_rule_doc.pdf')).toBe(true);
  });
});
