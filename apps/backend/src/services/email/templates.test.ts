import { describe, expect, it } from 'vitest';
import { resolveEmailTemplate } from './templates.js';

describe('resolveEmailTemplate', () => {
  it('renders organization invitation emails', () => {
    expect(
      resolveEmailTemplate('organization-invitation', {
        organizationName: 'DocShare University',
        inviterName: 'Admin User',
        inviteLink: 'https://app.example.test/invite/inv-1',
      }),
    ).toEqual({
      subject: 'DocShare University への招待',
      html: 'Admin User さんが DocShare University へ招待しました: https://app.example.test/invite/inv-1',
    });
  });

  it('renders invitation link-based owner emails', () => {
    expect(
      resolveEmailTemplate('university-owner-invitation-link', {
        universityName: 'Approve University',
        invitationLink: 'invitation:1234',
      }),
    ).toEqual({
      subject: 'Approve University の代表者招待',
      html: '招待リンク: invitation:1234',
    });
  });

  it('renders invitation id-based owner emails', () => {
    expect(
      resolveEmailTemplate('university-owner-invitation-id', {
        universityName: 'Created University',
        invitationId: 'inv-1234',
      }),
    ).toEqual({
      subject: 'Created University の代表者招待',
      html: '招待ID: inv-1234',
    });
  });

  it('renders member invitation emails', () => {
    expect(
      resolveEmailTemplate('organization-member-invitation-link', {
        organizationName: 'Engineering Org',
        invitationLink: 'invitation:5678',
      }),
    ).toEqual({
      subject: 'Engineering Org への招待',
      html: '招待リンク: invitation:5678',
    });
  });
});