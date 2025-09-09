/**
 * Unit tests for convex/services (createService, getServices).
 *
 * Testing framework: Compatible with Jest or Vitest (runtime-detected).
 * We prefer the project's existing test style from __tests__/convex/assessments.test.ts.
 *
 * Focus areas (from diff):
 * - createService:
 *   - trims name for validation; rejects on empty after trim
 *   - rejects if description > 2000 chars
 *   - rejects if basePrice < 0
 *   - requires user to have orgId, otherwise throws
 *   - tenant lookup via by_org_id; throws when not found
 *   - inserts into "services" with { tenantId, ...args } on success
 * - getServices:
 *   - returns [] if user has no orgId
 *   - returns [] if tenant not found
 *   - returns collected services for tenant
 */

type AnyFn = (...args: any[]) => any;

const isVitest = typeof globalThis !== 'undefined' && (globalThis as any).vi && typeof (globalThis as any).vi.fn === 'function';
const isJest = typeof globalThis !== 'undefined' && (globalThis as any).jest && typeof (globalThis as any).jest.fn === 'function';

const mockFn: (impl?: AnyFn) => jest.Mock | ((...args: any[]) => any) =
  isVitest
    ? (globalThis as any).vi.fn
    : isJest
    ? (globalThis as any).jest.fn
    : ((impl?: AnyFn) => ((...args: any[]) => impl?.(...args)));

const spyOn: (obj: any, key: string) => any =
  isVitest
    ? (globalThis as any).vi.spyOn
    : isJest
    ? (globalThis as any).jest.spyOn
    : ((obj: any) => obj);

const resetAll = () => {
  if (isVitest) (globalThis as any).vi.resetAllMocks?.();
  if (isJest) (globalThis as any).jest.resetAllMocks?.();
};

// Resolve services module path
const servicesPathCandidates = [
  '../../SlickSolutions/slicksolutions/convex/services',
  '../../convex/services',
  '../../services',
];

let servicesPath: string | null = null;
for (const p of servicesPathCandidates) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require.resolve(p);
    servicesPath = p;
    break;
  } catch {
    /* keep searching */
  }
}

if (!servicesPath) {
  throw new Error('Could not resolve convex/services module path.');
}

// Resolve and prepare to mock auth used by services
const authPathCandidates = [
  '../../SlickSolutions/slicksolutions/convex/auth',
  '../../convex/auth',
  '../../auth',
];

let authPath: string | null = null;
for (const p of authPathCandidates) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require.resolve(p);
    authPath = p;
    break;
  } catch {
    /* keep searching */
  }
}

if (!authPath) {
  throw new Error('Could not resolve convex/auth module path.');
}

// We do not rely on jest.mock/vi.mock hoisting since path is dynamic, so we will spy on the real module exports.
// This mirrors the pattern used in the repository's assessments tests where spies/mocks are applied at runtime.
const servicesMod = require(servicesPath);
const { createService, getServices } = servicesMod;
const authMod = require(authPath);

type Ctx = {
  db: {
    query: (table: string) => {
      withIndex: (name: string, cb: (q: { eq: (field: string, value: any) => any }) => any) => {
        unique: () => Promise<any | null>;
        collect: () => Promise<any[]>;
      };
    };
    insert: (table: string, doc: any) => Promise<string>;
  };
};

// Helper to create a chainable db.query mock
function makeDbQueryMock(options: { tenant?: any | null; services?: any[] }) {
  const eq = mockFn((_field: string, _value: any) => ({}));
  const unique = mockFn(async () => options.tenant ?? null);
  const collect = mockFn(async () => options.services ?? []);

  const withIndex = mockFn((_name: string, cb: (q: any) => any) => {
    try {
      cb({ eq });
    } catch {}
    return { unique, collect };
  });

  const query = mockFn((_table: string) => ({ withIndex }));

  const insert = mockFn(async (_table: string, _doc: any) => 'new_service_id');

  return { db: { query, insert }, spies: { eq, unique, collect, withIndex, query, insert } };
}

// Helper to call Convex function regardless of export shape
async function callConvex(fnExport: any, ctx: any, args?: any) {
  if (typeof fnExport === 'function') return await fnExport(ctx, args);
  if (fnExport && typeof fnExport.handler === 'function') return await fnExport.handler(ctx, args);
  throw new Error('Unsupported Convex export shape');
}

describe('convex/services.createService', () => {
  const baseArgs = {
    name: '  Deluxe Wash  ',
    description: 'Full exterior and interior cleaning.',
    basePrice: 49.99,
  };

  beforeEach(() => {
    resetAll();
    // Ensure auth methods are spies we can control per test
    if (!authMod.getUser || !authMod.assertRole) {
      throw new Error('auth module missing expected exports');
    }
    // Reset spies if previously wrapped
    if ((authMod.getUser as any).mockReset) (authMod.getUser as any).mockReset();
    if ((authMod.assertRole as any).mockReset) (authMod.assertRole as any).mockReset();
    // If not already a spy, wrap them
    if (!(authMod.getUser as any).mock) spyOn(authMod, 'getUser').mockImplementation(async () => ({}));
    if (!(authMod.assertRole as any).mock) spyOn(authMod, 'assertRole').mockImplementation(() => {});
  });

  test('rejects when name is empty after trimming (validation before auth)', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 't1' } });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'org1' });
    (authMod.assertRole as any).mockImplementation(() => {});

    await expect(
      callConvex(createService, { db } as Ctx, { ...baseArgs, name: '   ' })
    ).rejects.toThrow('Service name is required');

    expect(authMod.getUser).not.toHaveBeenCalled();
    expect(authMod.assertRole).not.toHaveBeenCalled();
  });

  test('rejects when description is too long', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 't1' } });
    await expect(
      callConvex(createService, { db } as Ctx, { ...baseArgs, description: 'x'.repeat(2001) })
    ).rejects.toThrow('Description too long');
  });

  test('rejects when basePrice is negative', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 't1' } });
    await expect(
      callConvex(createService, { db } as Ctx, { ...baseArgs, basePrice: -0.01 })
    ).rejects.toThrow('Base price must be >= 0');
  });

  test('requires user to belong to an organization', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 't1' } });
    (authMod.getUser as any).mockResolvedValue({ orgId: null });
    (authMod.assertRole as any).mockImplementation(() => {});

    await expect(callConvex(createService, { db } as Ctx, baseArgs)).rejects.toThrow(
      'User does not belong to an organization'
    );
  });

  test('rejects when tenant not found', async () => {
    const { db } = makeDbQueryMock({ tenant: null });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'org1' });
    (authMod.assertRole as any).mockImplementation(() => {});

    await expect(callConvex(createService, { db } as Ctx, baseArgs)).rejects.toThrow('Tenant not found');
  });

  test('inserts service with tenantId and provided args; enforces admin role', async () => {
    const { db, spies } = makeDbQueryMock({ tenant: { _id: 'tenant_123' } });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'orgA' });
    (authMod.assertRole as any).mockImplementation((_ctx: any, _user: any, role: string) => {
      if (role !== 'admin') throw new Error('wrong role');
    });

    await expect(callConvex(createService, { db } as Ctx, baseArgs)).resolves.toBeUndefined();

    expect(spies.insert).toHaveBeenCalledTimes(1);
    const [table, doc] = spies.insert.mock.calls[0];
    expect(table).toBe('services');
    // Note: Diff shows validation trims name for emptiness only; insertion spreads original args.
    expect(doc).toMatchObject({
      tenantId: 'tenant_123',
      name: baseArgs.name, // untrimmed as per current implementation
      description: baseArgs.description,
      basePrice: baseArgs.basePrice,
    });
    expect(authMod.assertRole).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'admin');
  });
});

describe('convex/services.getServices', () => {
  beforeEach(() => {
    resetAll();
    if ((authMod.getUser as any).mockReset) (authMod.getUser as any).mockReset();
  });

  test('returns [] if user has no orgId', async () => {
    const { db } = makeDbQueryMock({});
    (authMod.getUser as any).mockResolvedValue({ orgId: null });

    const out = await callConvex(getServices, { db } as Ctx, {});
    expect(out).toEqual([]);
  });

  test('returns [] if tenant not found', async () => {
    const { db } = makeDbQueryMock({ tenant: null, services: [{ _id: 's1' }] });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'orgZ' });

    const out = await callConvex(getServices, { db } as Ctx, {});
    expect(out).toEqual([]);
  });

  test('collects services for tenant', async () => {
    const result = [{ _id: 'a' }, { _id: 'b' }];
    const { db } = makeDbQueryMock({ tenant: { _id: 'tenant_9' }, services: result });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'org9' });

    const out = await callConvex(getServices, { db } as Ctx, {});
    expect(out).toEqual(result);
  });
});

/**
 * Additional tests appended: boundaries, early validation short-circuiting, and auth enforcement.
 * Test framework: continues using Jest/Vitest-compatible style already in this file.
 */

describe('convex/services.createService - boundaries and enforcement (appended)', () => {
  const baseArgs = {
    name: '  Premium Detail  ',
    description: 'Standard service description.',
    basePrice: 25,
  };

  beforeEach(() => {
    resetAll?.();
    // Ensure auth spies exist and are reset
    if (!authMod.getUser || !authMod.assertRole) {
      throw new Error('auth module missing expected exports');
    }
    if ((authMod.getUser as any).mockReset) (authMod.getUser as any).mockReset();
    if ((authMod.assertRole as any).mockReset) (authMod.assertRole as any).mockReset();
    if (!(authMod.getUser as any).mock) spyOn(authMod, 'getUser').mockImplementation(async () => ({}));
    if (!(authMod.assertRole as any).mock) spyOn(authMod, 'assertRole').mockImplementation(() => {});
  });

  test('allows 2000-char description and basePrice = 0 (boundary), inserts once', async () => {
    const args = { ...baseArgs, description: 'x'.repeat(2000), basePrice: 0 };
    const { db, spies } = makeDbQueryMock({ tenant: { _id: 'tenant_boundary' } });

    (authMod.getUser as any).mockResolvedValue({ orgId: 'orgBoundary' });
    (authMod.assertRole as any).mockImplementation((_ctx: any, _user: any, role: string) => {
      if (role !== 'admin') throw new Error('wrong role');
    });

    await expect(callConvex(createService, { db } as Ctx, args)).resolves.toBeUndefined();

    expect(spies.insert).toHaveBeenCalledTimes(1);
    const [table, doc] = spies.insert.mock.calls[0];
    expect(table).toBe('services');
    expect(doc).toMatchObject({
      tenantId: 'tenant_boundary',
      description: args.description,
      basePrice: 0,
      name: args.name, // name remains untrimmed on insert per implementation
    });
    expect((doc.description as string).length).toBe(2000);
  });

  test('rejects when assertRole throws (non-admin user); does not insert', async () => {
    const { db, spies } = makeDbQueryMock({ tenant: { _id: 'tenant_auth' } });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'orgAuth' });
    (authMod.assertRole as any).mockImplementation(() => {
      throw new Error('Forbidden');
    });

    await expect(callConvex(createService, { db } as Ctx, baseArgs)).rejects.toThrow('Forbidden');
    expect(spies.insert).not.toHaveBeenCalled();
  });

  test('validation short-circuits: description too long -> no auth or db calls', async () => {
    const { db, spies } = makeDbQueryMock({ tenant: { _id: 'tenant_x' } });

    await expect(
      callConvex(createService, { db } as Ctx, { ...baseArgs, description: 'y'.repeat(2001) })
    ).rejects.toThrow('Description too long');

    expect(authMod.getUser).not.toHaveBeenCalled();
    expect(authMod.assertRole).not.toHaveBeenCalled();
    expect(spies.query).not.toHaveBeenCalled();
    expect(spies.insert).not.toHaveBeenCalled();
  });

  test('validation short-circuits: negative basePrice -> no auth or db calls', async () => {
    const { db, spies } = makeDbQueryMock({ tenant: { _id: 'tenant_y' } });

    await expect(
      callConvex(createService, { db } as Ctx, { ...baseArgs, basePrice: -1 })
    ).rejects.toThrow('Base price must be >= 0');

    expect(authMod.getUser).not.toHaveBeenCalled();
    expect(authMod.assertRole).not.toHaveBeenCalled();
    expect(spies.query).not.toHaveBeenCalled();
    expect(spies.insert).not.toHaveBeenCalled();
  });

  test('requires user to belong to an organization (null/undefined orgId)', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 'tenant_org' } });
    (authMod.getUser as any).mockResolvedValue({ orgId: undefined });

    await expect(callConvex(createService, { db } as Ctx, baseArgs)).rejects.toThrow(
      'User does not belong to an organization'
    );
  });
});

describe('convex/services.getServices - additional (appended)', () => {
  beforeEach(() => {
    resetAll?.();
    if ((authMod.getUser as any).mockReset) (authMod.getUser as any).mockReset();
    if (!(authMod.getUser as any).mock) spyOn(authMod, 'getUser').mockImplementation(async () => ({}));
  });

  test('returns [] when tenant exists but has no services', async () => {
    const { db } = makeDbQueryMock({ tenant: { _id: 'tenant_empty' }, services: [] });
    (authMod.getUser as any).mockResolvedValue({ orgId: 'orgEmpty' });

    const out = await callConvex(getServices, { db } as Ctx, {});
    expect(out).toEqual([]);
  });
});