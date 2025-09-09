import { describe, it, expect } from "vitest";
/**
 * Unit tests for convex/auth.
 * Detected test framework: vitest.
 * Generated on 2025-09-08 (US).
 * Focus: assertRole and getUser behaviors, including happy paths, edge cases, and failure modes.
 */

type Role = 'admin' | 'detailer' | 'client';

/**
 * Creates a minimal mock of Convex ctx with auth and db APIs used by getUser.
 * Captures calls for verification.
 */
function makeCtx(options: {
  identity?: { subject: string } | null;
  uniqueResult?: any;
  uniqueError?: Error | null;
}) {
  const { identity = null, uniqueResult = null, uniqueError = null } = options || {};
  const calls: {
    table?: string;
    indexName?: string;
    eqArgs?: { field: string; value: any };
    eqCalls: Array<[string, any]>;
  } = { eqCalls: [] };

  const ctx: any = {
    auth: {
      async getUserIdentity() {
        return identity;
      },
    },
    db: {
      query(table: string) {
        calls.table = table;
        return {
          withIndex(indexName: string, cb: (q: any) => unknown) {
            calls.indexName = indexName;
            const q = {
              eq(field: string, value: any) {
                calls.eqArgs = { field, value };
                calls.eqCalls.push([field, value]);
                return {};
              },
            };
            // Execute the filter callback to mirror real behavior
            try { cb(q); } catch { /* ignore callback return */ }
            return {
              async unique() {
                if (uniqueError) throw uniqueError;
                return uniqueResult;
              },
            };
          },
        };
      },
    },
  };

  return { ctx, calls };
}

describe('assertRole', () => {
  it('does not throw when user has the required role (happy path)', () => {
    const user: any = { roles: ['admin', 'client'] };
    expect(() => assertRole({} as any, user, 'admin')).not.toThrow();
  });

  it('throws with a descriptive message when user lacks the role', () => {
    const user: any = { roles: ['client'] };
    expect(() => assertRole({} as any, user, 'admin')).toThrow(
      'User does not have the required role: admin'
    );
  });

  it('accepts other valid roles (detailer)', () => {
    const user: any = { roles: ['detailer'] };
    expect(() => assertRole({} as any, user, 'detailer')).not.toThrow();
  });

  it('throws when roles list is empty', () => {
    const user: any = { roles: [] };
    expect(() => assertRole({} as any, user, 'client')).toThrow(
      'User does not have the required role: client'
    );
  });
});

describe('getUser', () => {
  it('throws when not authenticated', async () => {
    const { ctx } = makeCtx({ identity: null });
    await expect(getUser(ctx)).rejects.toThrow('User is not authenticated');
  });

  it('throws when user record is not found', async () => {
    const identity = { subject: 'sub_123' };
    const { ctx } = makeCtx({ identity, uniqueResult: null });
    await expect(getUser(ctx)).rejects.toThrow('User not found');
  });

  it('returns the user when found and uses correct index lookup (happy path)', async () => {
    const identity = { subject: 'sub_abc' };
    const fakeUser = { _id: 'user_1', clerkId: identity.subject, roles: ['client'] };
    const { ctx, calls } = makeCtx({ identity, uniqueResult: fakeUser });

    const result = await getUser(ctx as any);

    // Validate return value
    expect(result).toEqual(fakeUser);

    // Validate DB query behavior
    expect(calls.table).toBe('users');
    expect(calls.indexName).toBe('by_clerk_id');
    expect(calls.eqArgs).toEqual({ field: 'clerkId', value: identity.subject });
  });

  it('propagates underlying db errors from unique()', async () => {
    const identity = { subject: 'oops' };
    const dbError = new Error('db failure');
    const { ctx } = makeCtx({ identity, uniqueError: dbError });

    await expect(getUser(ctx)).rejects.toThrow('db failure');
  });
});