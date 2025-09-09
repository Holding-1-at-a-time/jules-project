/**
 * Unit tests for convex/users.ts focusing on the recent diff:
 * - Migration to createClerkClient and env var checks
 * - Ensuring inviteClient uses Clerk client correctly and enforces permissions
 * - Core behaviors of me, createOrUpdateUser, deleteUser, assignRole
 *
 * Test Framework: Jest (TypeScript). If the project uses Vitest, this file's Jest APIs map closely (vi.mock etc.).
 */

import type { Id } from "../types"; // If your repo doesn't define this, these types are only for hints; tests use plain strings.
 
// Mock convex server wrappers so exported objects expose `handler`
jest.mock('../../convex/_generated/server', () => ({
  mutation: (def: any) => def,
  internalMutation: (def: any) => def,
  query: (def: any) => def,
}));

// Stub convex/values (only used for arg schemas; not needed in handler tests)
jest.mock('convex/values', () => ({
  v: {
    string: jest.fn(() => ({})),
    id: jest.fn(() => ({})),
  },
}));

// Mock @clerk/backend client factory
const createOrganizationInvitationMock = jest.fn();
jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    organizations: {
      createOrganizationInvitation: createOrganizationInvitationMock,
    },
    // Keep compatibility if older code tries invitations.createInvitation (defensive)
    invitations: {
      createInvitation: createOrganizationInvitationMock,
    },
  })),
}));

// Provide required env vars for module initialization
const ORIGINAL_ENV = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, CLERK_SECRET_KEY: 'test-secret', NEXT_PUBLIC_URL: 'http://localhost:3000' };
  createOrganizationInvitationMock.mockReset();
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// Helper: minimal ctx.db stub
function makeDb(overrides: Partial<Record<string, any>> = {}) {
  return {
    query: jest.fn().mockReturnValue({
      withIndex: jest.fn().mockImplementation((_, cb) => {
        const q = { eq: (_f: string, _v: any) => ({}) };
        return { unique: jest.fn().mockReturnValue(overrides.__uniqueReturn) };
      }),
      unique: jest.fn().mockReturnValue(overrides.__uniqueReturn),
    }),
    patch: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
    ...overrides,
  };
}

// Helper: minimal ctx
function makeCtx(dbOverrides: any = {}) {
  return { db: makeDb(dbOverrides) } as any;
}

// getUser and assertRole mocks
const mockUserBase = (u: Partial<{ roles: string[]; orgId?: string }> = {}) => ({
  _id: 'user_1' as any,
  clerkId: 'clerk_1',
  email: 'u@example.com',
  name: 'User',
  roles: [],
  ...u,
});

jest.mock('../../convex/auth', () => ({
  getUser: jest.fn(),
  assertRole: jest.fn(),
}));
import { getUser, assertRole } from '../../convex/auth';

describe('convex/users module', () => {
  // Re-import module per test so top-level env checks run with our env
  const importUsers = async () => await import('../../convex/users');

  describe('environment and Clerk client initialization', () => {
    test('throws if CLERK_SECRET_KEY is missing', async () => {
      process.env.CLERK_SECRET_KEY = '';
      await expect(import('../../convex/users')).rejects.toThrow('Missing CLERK_SECRET_KEY');
    });

    test('initializes Clerk client via createClerkClient when secret is present', async () => {
      await importUsers();
      // Client factory was called with the provided secret
      const { createClerkClient } = jest.requireMock('@clerk/backend');
      expect(createClerkClient).toHaveBeenCalledWith({ secretKey: 'test-secret' });
    });
  });

  describe('me', () => {
    test('returns the current user via getUser', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce({ id: 'abc' });
      const { me } = await importUsers();
      const res = await me.handler(makeCtx(), {});
      expect(getUser).toHaveBeenCalled();
      expect(res).toEqual({ id: 'abc' });
    });
  });

  describe('createOrUpdateUser', () => {
    test('patches existing user by clerkId', async () => {
      const db = makeDb({ __uniqueReturn: { _id: 'u1' } });
      const { createOrUpdateUser } = await importUsers();
      await createOrUpdateUser.handler({ db } as any, {
        clerkId: 'c_1',
        email: 'new@example.com',
        name: 'New Name',
      });
      expect(db.query).toHaveBeenCalledWith('users');
      expect(db.patch).toHaveBeenCalledWith('u1', { email: 'new@example.com', name: 'New Name' });
      expect(db.insert).not.toHaveBeenCalled();
    });

    test('inserts user if no existing match', async () => {
      const db = makeDb({ __uniqueReturn: null });
      const { createOrUpdateUser } = await importUsers();
      await createOrUpdateUser.handler({ db } as any, {
        clerkId: 'c_2',
        email: 'e@example.com',
        name: 'Name',
      });
      expect(db.insert).toHaveBeenCalledWith('users', {
        clerkId: 'c_2',
        email: 'e@example.com',
        name: 'Name',
        roles: [],
      });
      expect(db.patch).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    test('deletes user when found', async () => {
      const db = makeDb({ __uniqueReturn: { _id: 'u1' } });
      const { deleteUser } = await importUsers();
      await deleteUser.handler({ db } as any, { clerkId: 'c_1' });
      expect(db.delete).toHaveBeenCalledWith('u1');
    });

    test('no-op when user not found', async () => {
      const db = makeDb({ __uniqueReturn: null });
      const { deleteUser } = await importUsers();
      await deleteUser.handler({ db } as any, { clerkId: 'c_404' });
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  describe('inviteClient', () => {
    test('rejects when user lacks admin/detailer roles', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: [] }));
      const { inviteClient } = await importUsers();
      await expect(inviteClient.handler(makeCtx(), { email: 'client@example.com' }))
        .rejects.toThrow('User does not have permission to invite clients');
      expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
    });

    test('rejects when user has role but no orgId', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['admin'] }));
      const { inviteClient } = await importUsers();
      await expect(inviteClient.handler(makeCtx(), { email: 'client@example.com' }))
        .rejects.toThrow('User does not belong to an organization');
      expect(createOrganizationInvitationMock).not.toHaveBeenCalled();
    });

    test('creates organization invitation with proper params when authorized', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['detailer'], orgId: 'org_123' }));
      const { inviteClient } = await importUsers();
      await inviteClient.handler(makeCtx(), { email: 'client@example.com' });
      // Accept either new API (organizations.createOrganizationInvitation) or legacy invitations.createInvitation
      expect(createOrganizationInvitationMock).toHaveBeenCalledWith(expect.objectContaining({
        emailAddress: 'client@example.com',
        organizationId: 'org_123',
        role: 'org:member',
        redirectUrl: 'http://localhost:3000/',
      }));
    });
  });

  describe('assignRole', () => {
    test('requires admin via assertRole', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['admin'] }));
      const db = makeDb();
      db.get.mockResolvedValueOnce({ _id: 't1', roles: [] });
      const { assignRole } = await importUsers();
      await assignRole.handler({ db } as any, { userId: 't1' as any, role: 'detailer' });
      expect(assertRole).toHaveBeenCalled();
    });

    test('throws when target user not found', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['admin'] }));
      const db = makeDb();
      db.get.mockResolvedValueOnce(null);
      const { assignRole } = await importUsers();
      await expect(assignRole.handler({ db } as any, { userId: 'missing' as any, role: 'x' }))
        .rejects.toThrow('User not found');
    });

    test('no-op when role already present', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['admin'] }));
      const db = makeDb();
      db.get.mockResolvedValueOnce({ _id: 't1', roles: ['detailer'] });
      const { assignRole } = await importUsers();
      await assignRole.handler({ db } as any, { userId: 't1' as any, role: 'detailer' });
      expect(db.patch).not.toHaveBeenCalled();
    });

    test('appends role when absent', async () => {
      (getUser as jest.Mock).mockResolvedValueOnce(mockUserBase({ roles: ['admin'] }));
      const db = makeDb();
      db.get.mockResolvedValueOnce({ _id: 't1', roles: ['member'] });
      const { assignRole } = await importUsers();
      await assignRole.handler({ db } as any, { userId: 't1' as any, role: 'detailer' });
      expect(db.patch).toHaveBeenCalledWith('t1', { roles: ['member', 'detailer'] });
    });
  });
});