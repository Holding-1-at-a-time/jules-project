/**
 * Unit tests for convex/tenants.ts
 * Assumed framework: Jest (compatible with Vitest via global guards).
 * This file was bootstrapped because it was missing; additional tests appended below.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const vi: any;
declare const jest: any;
const isVitest = typeof vi !== 'undefined';
const hasJest = typeof jest !== 'undefined' && !!jest;
const mockFn: any = isVitest
  ? vi.fn.bind(vi)
  : hasJest && jest.fn
  ? jest.fn.bind(jest)
  : (() => {
      throw new Error('No Jest/Vitest detected');
    });
const resetAll = () => {
  try {
    vi.resetAllMocks();
  } catch {}
  try {
    jest.resetAllMocks();
  } catch {}
};
const clearAll = () => {
  try {
    vi.clearAllMocks();
  } catch {}
  try {
    jest.clearAllMocks();
  } catch {}
};

const mockClerkFactory = () => {
  const __clerkMock = {
    createOrganization: mockFn(),
    createOrganizationMembership: mockFn(),
  };
  (globalThis as any).__clerkMock = __clerkMock;
  class Clerk {
    organizations: any = {
      createOrganization: __clerkMock.createOrganization,
      createOrganizationMembership: __clerkMock.createOrganizationMembership,
    };
    constructor(_opts: any) {}
  }
  return { Clerk, __clerkMock };
};
const mockAuthFactory = () => {
  const __authMock = { getUser: mockFn(), assertRole: mockFn() };
  (globalThis as any).__authMock = __authMock;
  return {
    getUser: __authMock.getUser,
    assertRole: __authMock.assertRole,
  };
};
try {
  jest.mock('@clerk/clerk-sdk-node', () => mockClerkFactory());
} catch {}
try {
  jest.mock('../../convex/auth', () => mockAuthFactory());
} catch {}
try {
  vi.mock('@clerk/clerk-sdk-node', () => mockClerkFactory());
} catch {}
try {
  vi.mock('../../convex/auth', () => mockAuthFactory());
} catch {}

describe('convex/tenants - additional coverage', () => {
  let createTenant: any;
  let getTenant: any;

  beforeEach(async () => {
    resetAll();
    clearAll();
    process.env.CLERK_SECRET_KEY = 'test_secret';

    if (hasJest && typeof jest.isolateModules === 'function') {
      jest.isolateModules(() => {
        const mod = require('../../convex/tenants');
        createTenant = mod.createTenant;
        getTenant = mod.get;
      });
    } else {
      const mod = await import('../../convex/tenants');
      createTenant = (mod as any).createTenant;
      getTenant = (mod as any).get;
    }
  });

  const makeCtx = (overrides: Partial<any> = {}) => {
    const unique = mockFn();
    const withIndex = mockFn().mockImplementation(
      (_name: string, cb: (q: any) => any) => {
        const q = { eq: mockFn().mockReturnValue(undefined) };
        cb(q);
        return { unique };
      }
    );
    const query = mockFn().mockReturnValue({ withIndex });
    const ctx = { db: { insert: mockFn(), patch: mockFn(), query } } as any;
    Object.assign(ctx.db, overrides);
    return { ctx, query, withIndex, unique };
  };

  it('createTenant: membership creation failure prevents DB writes and propagates error', async () => {
    const { __authMock, __clerkMock } = globalThis as any;
    __authMock.getUser.mockResolvedValue({
      _id: 'u1',
      clerkId: 'c1',
      orgId: null,
    });
    __clerkMock.createOrganization.mockResolvedValue({ id: 'org_123' });
    __clerkMock.createOrganizationMembership.mockRejectedValue(
      new Error('membership fail')
    );

    const { ctx } = makeCtx();

    await expect((createTenant as any).handler(ctx, { name: 'Acme' })).rejects.toThrow(
      'membership fail'
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('createTenant: DB insert failure propagates and prevents user patch', async () => {
    const { __authMock, __clerkMock } = globalThis as any;
    __authMock.getUser.mockResolvedValue({
      _id: 'u2',
      clerkId: 'c2',
      orgId: null,
    });
    __clerkMock.createOrganization.mockResolvedValue({ id: 'org_555' });
    __clerkMock.createOrganizationMembership.mockResolvedValue({
      id: 'mem_9',
    });

    const { ctx } = makeCtx({
      insert: mockFn().mockRejectedValue(new Error('insert failed')),
      patch: mockFn(),
    });

    await expect((createTenant as any).handler(ctx, { name: 'BrokenInsert Co' })).rejects.toThrow(
      'insert failed'
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it('get: ensures q.eq called with "orgId" and current user orgId', async () => {
    const { __authMock } = globalThis as any;
    const userOrg = 'org_eq_check';
    __authMock.getUser.mockResolvedValue({
      _id: 'u3',
      clerkId: 'c3',
      orgId: userOrg,
    });

    // Capture q.eq to assert parameters
    const qEq = mockFn().mockReturnValue(undefined);
    const withIndex = mockFn().mockImplementation(
      (_name: string, cb: (q: any) => any) => {
        const q = { eq: qEq };
        cb(q);
        return { unique: mockFn().mockResolvedValue(undefined) };
      }
    );
    const query = mockFn().mockReturnValue({ withIndex });

    const ctx = { db: { insert: mockFn(), patch: mockFn(), query } } as any;
    await (getTenant as any).handler(ctx, {});
    expect(qEq).toHaveBeenCalledWith('orgId', userOrg);
  });
});