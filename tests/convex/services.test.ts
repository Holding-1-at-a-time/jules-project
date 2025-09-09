/*
  Tests for convex services:
  - createService mutation
  - getServices query

  Testing framework note:
  This suite is written to be compatible with either Vitest or Jest by resolving test functions from the available runtime.
  If both are available, Vitest takes precedence.
*/

function resolveTestAPI() {
  try {
    // Prefer vitest if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const v = require('vitest');
    return {
      describe: v.describe,
      it: v.it,
      test: v.test ?? v.it,
      expect: v.expect,
      beforeEach: v.beforeEach,
      vi: v.vi,
      mockFn: (impl?: any) => v.vi.fn(impl),
      spyOn: (obj: any, key: string) => v.vi.spyOn(obj, key),
      resetAllMocks: () => v.vi.resetAllMocks(),
      clearAllMocks: () => v.vi.clearAllMocks(),
    };
  } catch (e) {
    // Fallback to Jest
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const j = require('@jest/globals');
    const jestObj = (global as any).jest ?? (global as any).vi ?? undefined;
    const jestApi = (global as any).jest ?? {
      fn: (...args: any[]) => (jestObj ? jestObj.fn(...args) : () => {}),
      spyOn: (...args: any[]) => (jestObj ? jestObj.spyOn(...args) : () => {}),
      resetAllMocks: () => (jestObj ? jestObj.resetAllMocks() : undefined),
      clearAllMocks: () => (jestObj ? jestObj.clearAllMocks() : undefined),
    };
    return {
      describe: j.describe,
      it: j.it,
      test: j.test,
      expect: j.expect,
      beforeEach: j.beforeEach,
      vi: jestApi,
      mockFn: (impl?: any) => jestApi.fn(impl),
      spyOn: (obj: any, key: string) => jestApi.spyOn(obj, key as any),
      resetAllMocks: () => jestApi.resetAllMocks(),
      clearAllMocks: () => jestApi.clearAllMocks(),
    };
  }
}

const { describe, it, test, expect, beforeEach, vi, mockFn, spyOn, resetAllMocks, clearAllMocks } = resolveTestAPI();

// Import the module under test with relative path assumptions common to Convex apps.
// We try multiple potential locations to work across repo structures.

let servicesMod: any;
let importsError: Error | null = null;
const candidatePaths = [
  // Typical Convex function location
  '../../convex/services',
  '../convex/services',
  'convex/services',
  // If tests reside alongside code
  '../services',
  '../../src/convex/services',
  '../../../convex/services',
];

for (const p of candidatePaths) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    servicesMod = require(p);
    if (servicesMod.createService && servicesMod.getServices) {
      break;
    }
  } catch (err: any) {
    importsError = err;
    continue;
  }
}

if (!servicesMod.createService || !servicesMod.getServices) {
  // Provide a helpful error so devs can adjust the import path.
  throw new Error(
    "Unable to import convex/services module. Tried paths: " +
      candidatePaths.join(', ') +
      (importsError ? `; last error: ${importsError.message}` : '')
  );
}

const { createService, getServices } = servicesMod;

// Build a minimal Convex-like ctx.db mock with chainable API
const makeDb = (overrides: Partial<any> = {}) => {
  const api: any = {
    _queries: {},
    query: mockFn((table: string) => {
      const state: any = {
        _table: table,
        _index: null,
        _predicate: null,
        withIndex: mockFn((index: string, cb: (q: any) => any) => {
          state._index = index;
          const qb = {
            eq: mockFn((field: string, value: any) => {
              state._predicate = { field, value };
              return qb;
            }),
          };
          cb(qb);
          return {
            unique: mockFn(async () => {
              return api._queries[`${table}:${index}:${state._predicate?.field}=${String(state._predicate?.value)}`]?.unique ?? null;
            }),
            collect: mockFn(async () => {
              return api._queries[`${table}:${index}:${state._predicate?.field}=${String(state._predicate?.value)}`]?.collect ?? [];
            }),
          };
        }),
      };
      return state;
    }),
    insert: mockFn(async (_table: string, _doc: any) => {
      api._lastInserted = { table: _table, doc: _doc };
      return { _id: 'new_service_id' };
    }),
    _lastInserted: null,
    ...overrides,
  };
  return api;
};

// Minimal ctx with db
const makeCtx = (dbOverrides: Partial<any> = {}) => {
  return { db: makeDb(dbOverrides) };
};

// Mocks for auth helpers
let authMod: any;
const authPaths = [
  '../../convex/auth',
  '../convex/auth',
  'convex/auth',
  '../auth',
  '../../src/convex/auth',
  '../../../convex/auth',
];
for (const p of authPaths) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    authMod = require(p);
    break;
  } catch {
    // ignore
  }
}

// Fallback: create a shim if real module isn't resolvable in test env
if (!authMod) {
  authMod = {
    getUser: async (_ctx: any) => ({ _id: 'user_1', orgId: 'org_1', name: 'Test User' }),
    assertRole: (_ctx: any, _user: any, _role: string) => {},
  };
}

// Spy-capable wrappers
const getUser = mockFn(authMod.getUser);
const assertRole = mockFn(authMod.assertRole);

// Patch the imported module functions if they exist; otherwise rely on our wrappers where used.
try {
  if (servicesMod && servicesMod.__setAuthForTesting) {
    servicesMod.__setAuthForTesting({ getUser, assertRole });
  } else {
    // Best-effort monkey-patch require cache for './auth' used by services file
    // This is optional and may be ignored depending on bundler/test runner resolution.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request: string, parent: any, isMain: boolean) {
      if (request.endsWith('./auth') || request.endsWith('/convex/auth') || request.endsWith('convex/auth')) {
        return { getUser, assertRole };
      }
      return originalLoad.apply(this, arguments as any);
    };
  }
} catch {
  // Ignore if patching fails; tests will still stub via direct mock functions.
}

beforeEach(() => {
  resetAllMocks?.();
  clearAllMocks?.();
  getUser.mockReset?.();
  assertRole.mockReset?.();
});

describe('createService', () => {
  it('throws if user has no orgId', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: null });
    assertRole.mockImplementationOnce(() => {});

    // Provide tenant query defaults to avoid accidental positives
    (ctx.db as any)._queries = {};

    await expect(
      createService.handler(ctx, {
        name: 'S1',
        description: 'D',
        basePrice: 10,
      })
    ).rejects.toThrow('User does not belong to an organization');

    expect(getUser).toHaveBeenCalled();
    expect(assertRole).toHaveBeenCalledWith(ctx, { _id: 'u', orgId: null }, 'admin');
    expect((ctx.db as any).insert).not.toHaveBeenCalled();
  });

  it('throws if tenant not found for user org', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-123' });
    assertRole.mockImplementationOnce(() => {});
    // No tenant entry => unique() returns null
    (ctx.db as any)._queries = {
      // Intentionally empty: query('tenants').withIndex('by_org_id'...) will look up here and get undefined -> null
    };

    await expect(
      createService.handler(ctx, {
        name: 'S1',
        description: 'D',
        basePrice: 10,
      })
    ).rejects.toThrow('Tenant not found');

    expect(getUser).toHaveBeenCalled();
    expect(assertRole).toHaveBeenCalled();
    expect((ctx.db as any).insert).not.toHaveBeenCalled();
  });

  it('inserts new service with tenantId and args on happy path', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-123' });
    assertRole.mockImplementationOnce(() => {});
    const tenant = { _id: 'tenant-1', orgId: 'org-123' };

    (ctx.db as any)._queries = {
      "tenants:by_org_id:orgId=org-123": { unique: tenant },
    };

    const args = { name: 'Premium Wash', description: 'Foam + Wax', basePrice: 39.99 };
    await createService.handler(ctx, args);

    expect((ctx.db as any).insert).toHaveBeenCalledTimes(1);
    const inserted = (ctx.db as any)._lastInserted;
    expect(inserted.table).toBe('services');
    expect(inserted.doc).toEqual({
      tenantId: tenant._id,
      ...args,
    });
  });

  it('enforces admin role via assertRole', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-123' });
    const roleErr = new Error('not admin');
    assertRole.mockImplementationOnce(() => {
      throw roleErr;
    });

    await expect(
      createService.handler(ctx, { name: 'X', description: 'Y', basePrice: 1 })
    ).rejects.toThrow(roleErr);

    expect(assertRole).toHaveBeenCalled();
    expect((ctx.db as any).insert).not.toHaveBeenCalled();
  });
});

describe('getServices', () => {
  it('returns [] if user has no orgId', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: undefined });

    const result = await getServices.handler(ctx, {});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns [] if tenant not found', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-xyz' });
    (ctx.db as any)._queries = {
      // No matching tenant unique
    };

    const result = await getServices.handler(ctx, {});
    expect(result).toEqual([]);
  });

  it('collects services for tenant when present', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-abc' });

    const tenant = { _id: 'tenant-42', orgId: 'org-abc' };
    const services = [
      { _id: 's1', tenantId: tenant._id, name: 'Basic', description: 'Basic desc', basePrice: 10 },
      { _id: 's2', tenantId: tenant._id, name: 'Deluxe', description: 'Deluxe desc', basePrice: 25 },
    ];
    (ctx.db as any)._queries = {
      "tenants:by_org_id:orgId=org-abc": { unique: tenant },
      [`services:by_tenant_id:tenantId=${tenant._id}`]: { collect: services },
    };

    const result = await getServices.handler(ctx, {});
    expect(result).toEqual(services);
  });

  it('ensures services query uses by_tenant_id index', async () => {
    const ctx = makeCtx();
    getUser.mockResolvedValueOnce({ _id: 'u', orgId: 'org-abc' });
    const tenant = { _id: 'tenant-idx', orgId: 'org-abc' };
    const services = [{ _id: 's1', tenantId: tenant._id, name: 'Idx', description: '', basePrice: 1 }];
    (ctx.db as any)._queries = {
      "tenants:by_org_id:orgId=org-abc": { unique: tenant },
      [`services:by_tenant_id:tenantId=${tenant._id}`]: { collect: services },
    };

    const result = await getServices.handler(ctx, {});
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe(tenant._id);
  });
});