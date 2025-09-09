/**
 * Testing library/framework: Jest
 * Purpose: Unit tests for convex/users.ts operations focusing on public handlers.
 * Notes:
 *  - We mock Convex server registration helpers to expose raw handler functions.
 *  - We mock ./auth and @clerk/clerk-sdk-node to isolate behavior and avoid network calls.
 *  - Tests cover happy paths, edge cases, and failure conditions for:
 *      me, createOrUpdateUser, deleteUser, inviteClient, assignRole
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Spies needed by module mocks
const createInvitationSpy = jest.fn();
export const mockGetUser = jest.fn();
export const mockAssertRole = jest.fn();

// Mock Convex server registration to pass through definitions
jest.mock('../../convex/_generated/server', () => ({
  query: (x: any) => x,
  mutation: (x: any) => x,
  internalMutation: (x: any) => x,
}));

// Mock auth helpers
jest.mock('../../convex/auth', () => ({
  getUser: (...args: any[]) => (mockGetUser as any)(...args),
  assertRole: (...args: any[]) => (mockAssertRole as any)(...args),
}));

// Mock Clerk SDK
jest.mock('@clerk/clerk-sdk-node', () => ({
  Clerk: class {
    invitations = { createInvitation: createInvitationSpy };
    constructor(..._args: any[]) {}
  },
}));

// Import after mocks
import { me, createOrUpdateUser, deleteUser, inviteClient, assignRole } from '../../convex/users';

// Helper to build a mock Convex ctx with db methods and index chain
function makeCtx() {
  const uniqueSpy = jest.fn();
  const eqSpy = jest.fn();
  const withIndexSpy = jest.fn().mockImplementation((_name: string, cb: any) => {
    cb({ eq: eqSpy });
    return { unique: uniqueSpy };
  });
  const querySpy = jest.fn().mockImplementation((_table: string) => ({ withIndex: withIndexSpy }));
  const getSpy = jest.fn();
  const patchSpy = jest.fn();
  const insertSpy = jest.fn();
  const deleteSpy = jest.fn();

  const ctx: any = {
    db: {
      query: querySpy,
      get: getSpy,
      patch: patchSpy,
      insert: insertSpy,
      delete: deleteSpy,
    },
  };

  return {
    ctx,
    spies: { uniqueSpy, eqSpy, withIndexSpy, querySpy, getSpy, patchSpy, insertSpy, deleteSpy },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_URL = 'https://example.test';
  process.env.CLERK_SECRET_KEY = 'test_secret_key';
});

describe('me', () => {
  it('returns the current user from getUser', async () => {
    const { ctx } = makeCtx();
    const fakeUser = { _id: 'u1', email: 'user@example.com' };
    (mockGetUser as jest.Mock).mockResolvedValue(fakeUser);

    const res = await (me as any).handler(ctx);

    expect(mockGetUser).toHaveBeenCalledWith(ctx);
    expect(res).toEqual(fakeUser);
  });

  it('returns null/undefined transparently when getUser yields no user', async () => {
    const { ctx } = makeCtx();
    (mockGetUser as jest.Mock).mockResolvedValue(null);

    const res = await (me as any).handler(ctx);

    expect(res).toBeNull();
  });
});

describe('createOrUpdateUser', () => {
  it('patches an existing user matched by clerkId', async () => {
    const { ctx, spies } = makeCtx();
    spies.uniqueSpy.mockResolvedValue({ _id: 'user123', roles: ['member'] });

    await (createOrUpdateUser as any).handler(ctx, {
      clerkId: 'clerk_1',
      email: 'new@example.com',
      name: 'New Name',
    });

    expect(spies.querySpy).toHaveBeenCalledWith('users');
    expect(spies.withIndexSpy).toHaveBeenCalledWith('by_clerk_id', expect.any(Function));
    expect(spies.eqSpy).toHaveBeenCalledWith('clerkId', 'clerk_1');
    expect(spies.patchSpy).toHaveBeenCalledWith('user123', { email: 'new@example.com', name: 'New Name' });
    expect(spies.insertSpy).not.toHaveBeenCalled();
  });

  it('inserts a new user when not found', async () => {
    const { ctx, spies } = makeCtx();
    spies.uniqueSpy.mockResolvedValue(null);

    await (createOrUpdateUser as any).handler(ctx, {
      clerkId: 'clerk_2',
      email: 'first@example.com',
      name: 'First User',
    });

    expect(spies.insertSpy).toHaveBeenCalledWith('users', {
      clerkId: 'clerk_2',
      email: 'first@example.com',
      name: 'First User',
      roles: [],
    });
    expect(spies.patchSpy).not.toHaveBeenCalled();
  });
});

describe('deleteUser', () => {
  it('deletes user when a matching clerkId is found', async () => {
    const { ctx, spies } = makeCtx();
    spies.uniqueSpy.mockResolvedValue({ _id: 'user_to_delete' });

    await (deleteUser as any).handler(ctx, { clerkId: 'clerk_del' });

    expect(spies.deleteSpy).toHaveBeenCalledWith('user_to_delete');
  });

  it('is a no-op when no user is found', async () => {
    const { ctx, spies } = makeCtx();
    spies.uniqueSpy.mockResolvedValue(null);

    await (deleteUser as any).handler(ctx, { clerkId: 'missing' });

    expect(spies.deleteSpy).not.toHaveBeenCalled();
  });
});

describe('inviteClient', () => {
  it('requires detailer role and sends a Clerk invitation with proper fields', async () => {
    const { ctx } = makeCtx();
    const actingUser = { _id: 'u1', orgId: 'org_123' };
    (mockGetUser as jest.Mock).mockResolvedValue(actingUser);
    (mockAssertRole as jest.Mock).mockImplementation(() => {});

    await (inviteClient as any).handler(ctx, { email: 'client@example.com' });

    expect(mockAssertRole).toHaveBeenCalledWith(ctx, actingUser, 'detailer');
    expect(createInvitationSpy).toHaveBeenCalledTimes(1);
    expect(createInvitationSpy).toHaveBeenCalledWith({
      emailAddress: 'client@example.com',
      organizationId: 'org_123',
      role: 'org:member',
      redirectUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    });
  });

  it('throws when user has no organization', async () => {
    const { ctx } = makeCtx();
    (mockGetUser as jest.Mock).mockResolvedValue({ _id: 'u2', orgId: undefined });
    (mockAssertRole as jest.Mock).mockImplementation(() => {});

    await expect((inviteClient as any).handler(ctx, { email: 'client@example.com' }))
      .rejects.toThrow('User does not belong to an organization');

    expect(createInvitationSpy).not.toHaveBeenCalled();
  });
});

describe('assignRole', () => {
  it('requires admin role and appends new role to target user', async () => {
    const { ctx, spies } = makeCtx();
    const actingUser = { _id: 'admin_1' };
    (mockGetUser as jest.Mock).mockResolvedValue(actingUser);
    (mockAssertRole as jest.Mock).mockImplementation(() => {}); // pass
    spies.getSpy.mockResolvedValue({ _id: 'target_1', roles: ['member'] });

    await (assignRole as any).handler(ctx, { userId: 'target_1' as any, role: 'manager' });

    expect(mockAssertRole).toHaveBeenCalledWith(ctx, actingUser, 'admin');
    expect(spies.patchSpy).toHaveBeenCalledWith('target_1', { roles: ['member', 'manager'] });
  });

  it('throws when the target user does not exist', async () => {
    const { ctx, spies } = makeCtx();
    (mockGetUser as jest.Mock).mockResolvedValue({ _id: 'admin_1' });
    (mockAssertRole as jest.Mock).mockImplementation(() => {});
    spies.getSpy.mockResolvedValue(null);

    await expect((assignRole as any).handler(ctx, { userId: 'missing' as any, role: 'manager' }))
      .rejects.toThrow('User not found');

    expect(spies.patchSpy).not.toHaveBeenCalled();
  });
});