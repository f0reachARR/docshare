import { describe, expect, it } from 'vitest';
import { resolveEmailTemplate } from './templates.js';

describe('resolveEmailTemplate', () => {
  it('renders organization invitation emails', () => {
    const email = resolveEmailTemplate('organization-invitation', {
      organizationName: 'DocShare University',
      inviterName: 'Admin User',
      inviteLink: 'https://app.example.test/invite/inv-1',
    });

    expect(email.subject).toBe('DocShare University への招待');
    expect(email.html).toContain('Admin User さんから');
    expect(email.html).toContain('DocShare の DocShare University');
    expect(email.html).toContain('https://app.example.test/invite/inv-1');
    expect(email.text).toContain('Admin User さんから');
    expect(email.text).toContain('https://app.example.test/invite/inv-1');
  });

  it('renders invitation link-based owner emails', () => {
    const email = resolveEmailTemplate('university-owner-invitation-link', {
      universityName: 'Approve University',
      invitationLink: 'https://app.example.test/invite/1234',
    });

    expect(email.subject).toBe('Approve University の代表者招待');
    expect(email.html).toContain('代表者アカウントを設定するための招待リンク');
    expect(email.html).toContain('https://app.example.test/invite/1234');
    expect(email.text).toContain('代表者アカウントを設定するための招待リンク');
    expect(email.text).toContain('代表者設定を開く: https://app.example.test/invite/1234');
  });

  it('renders member invitation emails', () => {
    const email = resolveEmailTemplate('organization-member-invitation-link', {
      organizationName: 'Engineering Org',
      invitationLink: 'https://app.example.test/invite/5678',
    });

    expect(email.subject).toBe('Engineering Org への招待');
    expect(email.html).toContain('メンバーとして参加するための招待リンク');
    expect(email.html).toContain('https://app.example.test/invite/5678');
    expect(email.text).toContain('メンバーとして参加するための招待リンク');
    expect(email.text).toContain('メンバー招待を開く: https://app.example.test/invite/5678');
  });

  it('escapes dynamic values in html output', () => {
    const email = resolveEmailTemplate('organization-invitation', {
      organizationName: 'R&D <Team>',
      inviterName: 'Admin & Owner',
      inviteLink: 'https://app.example.test/invite?token=<abc>&next="home"',
    });

    expect(email.subject).toBe('R&D <Team> への招待');
    expect(email.html).toContain('R&amp;D &lt;Team&gt;');
    expect(email.html).toContain('Admin &amp; Owner');
    expect(email.html).toContain(
      'https://app.example.test/invite?token=&lt;abc&gt;&amp;next=&quot;home&quot;',
    );
    expect(email.text).toContain('R&D <Team>');
    expect(email.text).toContain('Admin & Owner');
  });
});
