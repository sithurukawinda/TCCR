import { User, UserProps } from '../../../src/domain/entities/User';

function makeUser(overrides: Partial<UserProps> = {}): User {
  return new User({
    uid:             'uid-1',
    email:           'viruli@example.com',
    firstName:       'Viruli',
    lastName:        'Weerasinghe',
    role:            'student',
    roles:           ['student'],
    status:          'approved',
    profilePhotoUrl: null,
    createdAt:       '2026-05-01T08:00:00.000Z',
    updatedAt:       '2026-05-01T08:00:00.000Z',
    deletedAt:       null,
    ...overrides,
  });
}

describe('User entity', () => {

  describe('fullName', () => {
    it('returns firstName and lastName joined', () => {
      expect(makeUser().fullName).toBe('Viruli Weerasinghe');
    });
  });

  describe('isActive()', () => {
    it('returns true when status is approved and not deleted', () => {
      expect(makeUser({ status: 'approved', deletedAt: null }).isActive()).toBe(true);
    });

    it('returns false when status is suspended', () => {
      expect(makeUser({ status: 'suspended' }).isActive()).toBe(false);
    });

    it('returns false when deletedAt is set', () => {
      expect(makeUser({ deletedAt: '2026-05-07T10:00:00.000Z' }).isActive()).toBe(false);
    });
  });

  describe('suspend()', () => {
    it('sets status to suspended', () => {
      const user = makeUser({ status: 'approved' });
      user.suspend();
      expect(user.status).toBe('suspended');
    });

    it('updates updatedAt', () => {
      const user = makeUser();
      const before = user.updatedAt;
      user.suspend();
      expect(user.updatedAt).not.toBe(before);
    });
  });

  describe('reactivate()', () => {
    it('sets status back to approved', () => {
      const user = makeUser({ status: 'suspended' });
      user.reactivate();
      expect(user.status).toBe('approved');
    });
  });

  describe('approve()', () => {
    it('sets status to approved', () => {
      const user = makeUser({ status: 'pending_approval' });
      user.approve();
      expect(user.status).toBe('approved');
    });
  });

  describe('updateProfile()', () => {
    it('updates only the provided fields', () => {
      const user = makeUser();
      user.updateProfile({ firstName: 'Kavinda' });
      expect(user.firstName).toBe('Kavinda');
      expect(user.lastName).toBe('Weerasinghe'); // unchanged
    });

    it('updates profilePhotoUrl to null when explicitly set', () => {
      const user = makeUser({ profilePhotoUrl: 'https://old-url.com' });
      user.updateProfile({ profilePhotoUrl: null });
      expect(user.profilePhotoUrl).toBeNull();
    });

    it('does not change fields when no fields provided', () => {
      const user = makeUser();
      const before = { firstName: user.firstName, lastName: user.lastName };
      user.updateProfile({});
      expect(user.firstName).toBe(before.firstName);
      expect(user.lastName).toBe(before.lastName);
    });
  });

  describe('softDelete()', () => {
    it('sets deletedAt to a timestamp', () => {
      const user = makeUser();
      expect(user.deletedAt).toBeNull();
      user.softDelete();
      expect(user.deletedAt).not.toBeNull();
      expect(() => new Date(user.deletedAt!)).not.toThrow();
    });

    it('isDeleted() returns true after softDelete', () => {
      const user = makeUser();
      user.softDelete();
      expect(user.isDeleted()).toBe(true);
    });
  });

  // ── V2 Phase 1 tests ───────────────────────────────────────────────────────

  describe('preferredLanguage', () => {
    it('defaults to "en" when not provided', () => {
      const user = makeUser();
      expect(user.preferredLanguage).toBe('en');
    });

    it('stores provided preferredLanguage', () => {
      const user = makeUser({ preferredLanguage: 'si' });
      expect(user.preferredLanguage).toBe('si');
    });

    it('updateProfile() can change preferredLanguage', () => {
      const user = makeUser({ preferredLanguage: 'en' });
      user.updateProfile({ preferredLanguage: 'ta' });
      expect(user.preferredLanguage).toBe('ta');
    });

    it('updateProfile() leaves preferredLanguage unchanged when not provided', () => {
      const user = makeUser({ preferredLanguage: 'si' });
      user.updateProfile({ firstName: 'New' });
      expect(user.preferredLanguage).toBe('si');
    });
  });

  describe('addRole() — V2 additive roles', () => {
    it('adds a new role to the roles array', () => {
      const user = makeUser({ role: 'member', roles: ['member'] });
      user.addRole('student');
      expect(user.roles).toEqual(['member', 'student']);
    });

    it('does not add duplicate role', () => {
      const user = makeUser({ role: 'member', roles: ['member', 'student'] });
      user.addRole('student');
      expect(user.roles).toEqual(['member', 'student']);
    });

    it('updates updatedAt when role is added', () => {
      const user  = makeUser({ role: 'member', roles: ['member'] });
      const before = user.updatedAt;
      user.addRole('student');
      expect(user.updatedAt).not.toBe(before);
    });

    it('does not update updatedAt when role already exists', () => {
      const user   = makeUser({ role: 'member', roles: ['member'] });
      const before = user.updatedAt;
      user.addRole('member'); // already present
      expect(user.updatedAt).toBe(before);
    });

    it('can hold multiple roles simultaneously', () => {
      const user = makeUser({ role: 'member', roles: ['member'] });
      user.addRole('student');
      user.addRole('leader');
      expect(user.roles).toContain('member');
      expect(user.roles).toContain('student');
      expect(user.roles).toContain('leader');
    });
  });

  describe('removeRole() — V2 role removal', () => {
    it('removes a role from the roles array', () => {
      const user = makeUser({ role: 'member', roles: ['member', 'student'] });
      user.removeRole('student');
      expect(user.roles).toEqual(['member']);
    });

    it('NEVER removes the member role', () => {
      const user = makeUser({ role: 'member', roles: ['member', 'student'] });
      user.removeRole('member');
      expect(user.roles).toContain('member');
    });

    it('updates updatedAt when role is removed', () => {
      const user   = makeUser({ role: 'member', roles: ['member', 'student'] });
      const before = user.updatedAt;
      user.removeRole('student');
      expect(user.updatedAt).not.toBe(before);
    });

    it('removes leader role safely', () => {
      const user = makeUser({ role: 'member', roles: ['member', 'student', 'leader'] });
      user.removeRole('leader');
      expect(user.roles).toEqual(['member', 'student']);
    });
  });

  describe('V2 registration — member defaults', () => {
    it('new member has roles:["member"] and status:approved', () => {
      const user = makeUser({ role: 'member', roles: ['member'], status: 'approved' });
      expect(user.roles).toEqual(['member']);
      expect(user.status).toBe('approved');
    });

    it('member can be promoted by adding student role', () => {
      const user = makeUser({ role: 'member', roles: ['member'], status: 'approved' });
      user.addRole('student');
      expect(user.roles).toContain('member');
      expect(user.roles).toContain('student');
      expect(user.roles).toHaveLength(2);
    });
  });
});
