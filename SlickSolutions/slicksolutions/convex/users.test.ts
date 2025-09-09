/**
 * Testing library and framework:
 * - These tests are compatible with Vitest or Jest (no new deps introduced).
 * - We mock Convex runtime modules to avoid requiring generated files at test-time.
 */

declare const vi: any;
declare const jest: any;

/* Mocks for Convex modules so importing ./users does not require generated code */
if ((globalThis as any).vi?.mock) {
  (globalThis as any).vi.mock('./_generated/server', () => ({
    query: (x: any) => x,
    mutation: (x: any) => x,
    internalQuery: (x: any) => x,
  }));
  (globalThis as any).vi.mock('convex/values', () => ({
    v: {
      string: () => 'string',
      id: () => 'id',
      optional: (inner: any) => inner,
      array: (inner: any) => [inner],
    },
  }));
}
if ((globalThis as any).jest?.mock) {
  (globalThis as any).jest.mock('./_generated/server', () => ({
    query: (x: any) => x,
    mutation: (x: any) => x,
    internalQuery: (x: any) => x,
  }));
  (globalThis as any).jest.mock('convex/values', () => ({
    v: {
      string: () => 'string',
      id: () => 'id',
      optional: (inner: any) => inner,
      array: (inner: any) => [inner],
    },
  }));
}

import * as UsersModule from './users';

const spy = (globalThis as any).vi ?? (globalThis as any).jest;
const fn = spy?.fn ?? (() => { throw new Error('No mocking fn available (vi.fn/jest.fn missing)'); });

type MockFn = (...args: any[]) => any;

type Ctx = {
  db: {
    insert: MockFn;
    patch: MockFn;
    get: MockFn;
    query: MockFn;
  };
  auth: {
    getUserIdentity: MockFn;
  };
};

function makeCtx() {
  // Build a chainable query builder
  const withIndex = fn();
  const qBuilder: any = {
    withIndex,
    unique: fn(),
  };
  // Return the builder to allow chaining .unique()
  withIndex.mockImplementation((_index: any, _predicate: any) => qBuilder);

  const ctx: Ctx = {
    db: {
      insert: fn(),
      patch: fn(),
      get: fn(),
      query: fn().mockImplementation((_collection: any) => qBuilder),
    },
    auth: {
      getUserIdentity: fn(),
    },
  };
  return { ctx, qBuilder };
}

// Helper to call Convex-style exported objects with .handler
async function callHandler(mod: any, ctx: any, args: any) {
  if (!mod || typeof mod.handler !== 'function') {
    throw new Error('Export is missing a .handler; ensure you are importing the right symbol.');
  }
  return mod.handler(ctx, args);
}

afterEach(() => {
  spy?.clearAllMocks?.();
  spy?.resetAllMocks?.();
});

describe('convex/users', () => {
  describe('create', () => {
    it('inserts a new user with roles defaulted to [] and returns new id (happy path)', async () => {
      const { ctx } = makeCtx();
      const newId = 'new_user_id_123';
      ctx.db.insert.mockResolvedValueOnce(newId);

      const args = { clerkId: 'clrk_1', email: 'a@example.com', name: 'Alice' };
      const result = await callHandler(UsersModule.create, ctx, args);

      expect(ctx.db.insert).toHaveBeenCalledTimes(1);
      expect(ctx.db.insert).toHaveBeenCalledWith('users', {
        clerkId: 'clrk_1',
        email: 'a@example.com',
        name: 'Alice',
        roles: [],
      });
      expect(result).toBe(newId);
    });

    it('propagates db.insert errors (failure path)', async () => {
      const { ctx } = makeCtx();
      ctx.db.insert.mockRejectedValueOnce(new Error('db down'));
      await expect(callHandler(UsersModule.create, ctx, { clerkId: 'x', email: 'e@e.com', name: 'N' }))
        .rejects.toThrow('db down');
    });
  });

  describe('get', () => {
    it('queries by by_clerk_id index, uses predicate, and returns unique user (found)', async () => {
      const { ctx, qBuilder } = makeCtx();
      const user = { _id: 'u1', clerkId: 'c1' };
      qBuilder.unique.mockResolvedValueOnce(user);

      const result = await callHandler(UsersModule.get, ctx, { clerkId: 'c1' });

      expect(ctx.db.query).toHaveBeenCalledWith('users');
      expect(qBuilder.withIndex).toHaveBeenCalledTimes(1);
      const [indexName, predicate] = qBuilder.withIndex.mock.calls[0];
      expect(indexName).toBe('by_clerk_id');
      const qFake = { eq: fn() };
      predicate(qFake);
      expect(qFake.eq).toHaveBeenCalledWith('clerkId', 'c1');

      expect(qBuilder.unique).toHaveBeenCalledTimes(1);
      expect(result).toEqual(user);
    });

    it('returns null when user not found', async () => {
      const { ctx, qBuilder } = makeCtx();
      qBuilder.unique.mockResolvedValueOnce(null);

      const result = await callHandler(UsersModule.get, ctx, { clerkId: 'c-missing' });
      expect(result).toBeNull();
    });

    it('propagates errors from unique()', async () => {
      const { ctx, qBuilder } = makeCtx();
      qBuilder.unique.mockRejectedValueOnce(new Error('unique failed'));
      await expect(callHandler(UsersModule.get, ctx, { clerkId: 'c1' })).rejects.toThrow('unique failed');
    });
  });

  describe('update', () => {
    it('patches only provided fields (tenantId and roles) on id', async () => {
      const { ctx } = makeCtx();
      ctx.db.patch.mockResolvedValueOnce(undefined);

      const args = { id: 'user_1', tenantId: 't1', roles: ['admin'] } as any;
      await callHandler(UsersModule.update, ctx, args);

      expect(ctx.db.patch).toHaveBeenCalledWith('user_1', { tenantId: 't1', roles: ['admin'] });
    });

    it('patches when only roles provided', async () => {
      const { ctx } = makeCtx();
      const args = { id: 'user_2', roles: [] } as any;
      await callHandler(UsersModule.update, ctx, args);
      expect(ctx.db.patch).toHaveBeenCalledWith('user_2', { roles: [] });
    });

    it('patches when only tenantId provided', async () => {
      const { ctx } = makeCtx();
      const args = { id: 'user_3', tenantId: 't9' } as any;
      await callHandler(UsersModule.update, ctx, args);
      expect(ctx.db.patch).toHaveBeenCalledWith('user_3', { tenantId: 't9' });
    });

    it('patches with empty object when no fields provided', async () => {
      const { ctx } = makeCtx();
      await callHandler(UsersModule.update, ctx, { id: 'user_empty' } as any);
      expect(ctx.db.patch).toHaveBeenCalledWith('user_empty', {});
    });

    it('propagates db.patch errors', async () => {
      const { ctx } = makeCtx();
      ctx.db.patch.mockRejectedValueOnce(new Error('no write access'));
      await expect(callHandler(UsersModule.update, ctx, { id: 'user_x' } as any)).rejects.toThrow('no write access');
    });
  });

  describe('me', () => {
    it('returns null when not authenticated', async () => {
      const { ctx } = makeCtx();
      ctx.auth.getUserIdentity.mockResolvedValueOnce(null);

      const result = await callHandler(UsersModule.me, ctx, {});
      expect(result).toBeNull();
      expect(ctx.db.query).not.toHaveBeenCalled();
    });

    it('returns user matching identity.subject via by_clerk_id', async () => {
      const { ctx, qBuilder } = makeCtx();
      ctx.auth.getUserIdentity.mockResolvedValueOnce({ subject: 'sub_123' });
      const user = { _id: 'u99', clerkId: 'sub_123' };
      qBuilder.unique.mockResolvedValueOnce(user);

      const result = await callHandler(UsersModule.me, ctx, {});
      expect(ctx.db.query).toHaveBeenCalledWith('users');
      expect(qBuilder.withIndex).toHaveBeenCalledTimes(1);
      const [indexName, predicate] = qBuilder.withIndex.mock.calls[0];
      expect(indexName).toBe('by_clerk_id');
      const qFake = { eq: fn() };
      predicate(qFake);
      expect(qFake.eq).toHaveBeenCalledWith('clerkId', 'sub_123');

      expect(result).toEqual(user);
    });

    it('returns null if authenticated but user record missing', async () => {
      const { ctx, qBuilder } = makeCtx();
      ctx.auth.getUserIdentity.mockResolvedValueOnce({ subject: 'sub_missing' });
      qBuilder.unique.mockResolvedValueOnce(null);

      const result = await callHandler(UsersModule.me, ctx, {});
      expect(result).toBeNull();
    });

    it('propagates errors from unique() when authenticated', async () => {
      const { ctx, qBuilder } = makeCtx();
      ctx.auth.getUserIdentity.mockResolvedValueOnce({ subject: 'sub_err' });
      qBuilder.unique.mockRejectedValueOnce(new Error('db fail'));
      await expect(callHandler(UsersModule.me, ctx, {})).rejects.toThrow('db fail');
    });
  });

  describe('getSubscriptionStatus', () => {
    it('returns subscriptionStatus when user exists', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: 'u1', subscriptionStatus: 'active' });
      const result = await callHandler(UsersModule.getSubscriptionStatus, ctx, { userId: 'u1' } as any);
      expect(ctx.db.get).toHaveBeenCalledWith('u1');
      expect(result).toBe('active');
    });

    it('returns undefined when user not found', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce(null);
      const result = await callHandler(UsersModule.getSubscriptionStatus, ctx, { userId: 'nope' } as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined when user has no subscriptionStatus field', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: 'u2' });
      const result = await callHandler(UsersModule.getSubscriptionStatus, ctx, { userId: 'u2' } as any);
      expect(result).toBeUndefined();
    });

    it('propagates db.get errors', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockRejectedValueOnce(new Error('get failed'));
      await expect(callHandler(UsersModule.getSubscriptionStatus, ctx, { userId: 'u1' } as any))
        .rejects.toThrow('get failed');
    });
  });

  describe('getStripeCustomerId', () => {
    it('returns stripeCustomerId when present', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: 'u1', stripeCustomerId: 'cus_123' });
      const result = await callHandler(UsersModule.getStripeCustomerId, ctx, { userId: 'u1' } as any);
      expect(ctx.db.get).toHaveBeenCalledWith('u1');
      expect(result).toBe('cus_123');
    });

    it('returns undefined when missing', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce({ _id: 'u1' });
      const result = await callHandler(UsersModule.getStripeCustomerId, ctx, { userId: 'u1' } as any);
      expect(result).toBeUndefined();
    });

    it('returns undefined when user not found', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockResolvedValueOnce(null);
      const result = await callHandler(UsersModule.getStripeCustomerId, ctx, { userId: 'none' } as any);
      expect(result).toBeUndefined();
    });

    it('propagates db.get errors', async () => {
      const { ctx } = makeCtx();
      ctx.db.get.mockRejectedValueOnce(new Error('boom'));
      await expect(callHandler(UsersModule.getStripeCustomerId, ctx, { userId: 'u1' } as any))
        .rejects.toThrow('boom');
    });
  });

  describe('getUser (internalQuery)', () => {
    it('queries by clerkId using index, applies predicate, and returns unique user', async () => {
      const { ctx, qBuilder } = makeCtx();
      const user = { _id: 'u7', clerkId: 'ck_7' };
      qBuilder.unique.mockResolvedValueOnce(user);

      const result = await callHandler(UsersModule.getUser, ctx, { clerkId: 'ck_7' });
      expect(ctx.db.query).toHaveBeenCalledWith('users');

      expect(qBuilder.withIndex).toHaveBeenCalledTimes(1);
      const [indexName, predicate] = qBuilder.withIndex.mock.calls[0];
      expect(indexName).toBe('by_clerk_id');
      const qFake = { eq: fn() };
      predicate(qFake);
      expect(qFake.eq).toHaveBeenCalledWith('clerkId', 'ck_7');

      expect(result).toEqual(user);
    });

    it('returns null when not found', async () => {
      const { ctx, qBuilder } = makeCtx();
      qBuilder.unique.mockResolvedValueOnce(null);

      const result = await callHandler(UsersModule.getUser, ctx, { clerkId: 'missing' });
      expect(result).toBeNull();
    });

    it('propagates unique() errors', async () => {
      const { ctx, qBuilder } = makeCtx();
      qBuilder.unique.mockRejectedValueOnce(new Error('index broken'));
      await expect(callHandler(UsersModule.getUser, ctx, { clerkId: 'ck_err' }))
        .rejects.toThrow('index broken');
    });
  });
});