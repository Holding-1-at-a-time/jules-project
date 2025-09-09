/**
 * Unit tests for Convex tenants server functions.
 *
 * Detected testing framework: Jest (expect/describe/test) with TypeScript.
 * If your repo uses Vitest, these tests are compatible with minimal changes:
 * - replace jest.mock with vi.mock
 * - import { describe, it, expect, beforeEach, vi } from 'vitest'
 */

type AnyFn = (...args: any[]) => any;

// Dynamically resolve module under test from common locations.
// This allows the test to run regardless of whether the repo places convex functions
// under convex/, src/convex/, or app/convex/.
function resolveModule(): string {
  const candidates = [
    'convex/tenants',
    'src/convex/tenants',
    'app/convex/tenants',
    './convex/tenants',
    './src/convex/tenants',
    './app/convex/tenants',
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require.resolve(p);
      return p;
    } catch (_e) {
      /* try next */
    }
  }
  // Fall back to relative from test file to repo root "tenants" if present.
  return 'convex/tenants';
}

const MODULE_PATH = resolveModule();

// Mock external dependencies
jest.mock('@clerk/clerk-sdk-node', () => {
  const createOrganization = jest.fn();
  const createOrganizationMembership = jest.fn();

  const organizations = {
    createOrganization,
    createOrganizationMembership,
  };

  const Clerk = function Clerk(this: any) {
    return { organizations };
  } as unknown as { new(...args: any[]): any };

  return { Clerk };
});

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

// Mock local auth utilities
jest.mock(MODULE_PATH.replace(/tenants$/, 'auth'), () => ({
  getUser: jest.fn(),
  assertRole: jest.fn(),
}));

// Import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tenantsMod = require(MODULE_PATH);

type CtxDb = {
  insert: jest.Mock,
  patch: jest.Mock,
  get: jest.Mock,
  query: jest.Mock<() => any>,
};
type Ctx = { db: CtxDb };

const { Clerk } = require('@clerk/clerk-sdk-node');
const QRCode = require('qrcode');
const { getUser, assertRole } = require(MODULE_PATH.replace(/tenants$/, 'auth'));

describe('convex/tenants server functions', () => {
  let ctx: Ctx;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Build a minimal ctx.db mock that supports the chained query().withIndex().unique()
    const unique = jest.fn();
    const withIndex = jest.fn().mockReturnValue({ unique });
    const query = jest.fn().mockReturnValue({ withIndex });

    ctx = {
      db: {
        insert: jest.fn(),
        patch: jest.fn(),
        get: jest.fn(),
        query,
      } as unknown as CtxDb,
    };
  });

  describe('createTenant', () => {
    test('creates Clerk organization, membership, inserts tenant, and patches user (happy path)', async () => {
      // Arrange
      const user = { _id: 'user_doc_id', clerkId: 'user_123', roles: ['member'], orgId: undefined };
      (getUser as jest.Mock).mockResolvedValue(user);

      // Mock Clerk org creation to yield id
      const clerkInstance = Clerk();
      (clerkInstance.organizations.createOrganization as jest.Mock).mockResolvedValue({ id: 'org_abc' });
      (clerkInstance.organizations.createOrganizationMembership as jest.Mock).mockResolvedValue({ id: 'mem_1' });

      // DB insert returns tenantId
      (ctx.db.insert as jest.Mock).mockResolvedValue('tenant_1');

      // Act
      const tenantId = await tenantsMod.createTenant(ctx, { name: 'Acme Co' });

      // Assert
      expect(getUser).toHaveBeenCalledWith(ctx);
      expect(clerkInstance.organizations.createOrganization).toHaveBeenCalledWith({
        name: 'Acme Co',
        createdBy: 'user_123',
      });
      expect(clerkInstance.organizations.createOrganizationMembership).toHaveBeenCalledWith({
        organizationId: 'org_abc',
        userId: 'user_123',
        role: 'org:admin',
      });
      expect(ctx.db.insert).toHaveBeenCalledWith('tenants', { name: 'Acme Co', orgId: 'org_abc' });
      expect(ctx.db.patch).toHaveBeenCalledWith('user_doc_id', {
        orgId: 'org_abc',
        roles: ['member', 'admin'],
      });
      expect(tenantId).toBe('tenant_1');
    });

    test('throws if Clerk did not return organization id', async () => {
      const user = { _id: 'user_doc_id', clerkId: 'user_123', roles: ['member'] };
      (getUser as jest.Mock).mockResolvedValue(user);

      const clerkInstance = Clerk();
      (clerkInstance.organizations.createOrganization as jest.Mock).mockResolvedValue({ id: '' });

      await expect(tenantsMod.createTenant(ctx, { name: 'NoId Inc' }))
        .rejects
        .toThrow('Failed to create organization in Clerk');

      expect(ctx.db.insert).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    test('returns null when user has no orgId', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: [] });

      const result = await tenantsMod.get(ctx, {});

      expect(result).toBeNull();
      expect(ctx.db.query).not.toHaveBeenCalled();
    });

    test('queries tenants by user orgId and returns unique result', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: [], orgId: 'org_abc' });

      const uniqueTenant = { _id: 'tenant_1', name: 'Acme Co', orgId: 'org_abc' };
      // Setup chain: query('tenants').withIndex('by_org_id', cb).unique() -> uniqueTenant
      const unique = jest.fn().mockResolvedValue(uniqueTenant);
      const withIndex = jest.fn().mockImplementation((_idx: string, cb: AnyFn) => {
        // Verify the equality filter callback is provided
        expect(typeof cb).toBe('function');
        return { unique };
      });
      (ctx.db.query as jest.Mock).mockReturnValue({ withIndex });

      const result = await tenantsMod.get(ctx, {});

      expect(ctx.db.query).toHaveBeenCalledWith('tenants');
      expect(withIndex).toHaveBeenCalledWith('by_org_id', expect.any(Function));
      expect(unique).toHaveBeenCalled();
      expect(result).toEqual(uniqueTenant);
    });
  });

  describe('generateQrCode', () => {
    test('asserts admin role, validates tenant ownership, generates QR code, and patches db', async () => {
      const user = { _id: 'u1', clerkId: 'c1', roles: ['admin'], orgId: 'org_abc' };
      (getUser as jest.Mock).mockResolvedValue(user);
      (assertRole as jest.Mock).mockImplementation((_ctx, _user, role) => {
        expect(role).toBe('admin');
      });

      const tenantId = 'tenant_1';
      const tenantDoc = { _id: tenantId, orgId: 'org_abc', name: 'Acme Co' };
      (ctx.db.get as jest.Mock).mockResolvedValue(tenantDoc);

      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,FAKE');

      const qr = await tenantsMod.generateQrCode(ctx, { tenantId });

      expect(ctx.db.get).toHaveBeenCalledWith(tenantId);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(`/assessment/${tenantId}`);
      expect(ctx.db.patch).toHaveBeenCalledWith(tenantId, { qrCode: 'data:image/png;base64,FAKE' });
      expect(qr).toBe('data:image/png;base64,FAKE');
    });

    test('throws when tenant not found', async () => {
      const user = { _id: 'u1', clerkId: 'c1', roles: ['admin'], orgId: 'org_abc' };
      (getUser as jest.Mock).mockResolvedValue(user);
      (assertRole as jest.Mock).mockImplementation(() => {});
      (ctx.db.get as jest.Mock).mockResolvedValue(null);

      await expect(tenantsMod.generateQrCode(ctx, { tenantId: 'missing' }))
        .rejects
        .toThrow('Tenant not found or access denied');

      expect(QRCode.toDataURL).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });

    test('throws when tenant belongs to different org', async () => {
      const user = { _id: 'u1', clerkId: 'c1', roles: ['admin'], orgId: 'org_abc' };
      (getUser as jest.Mock).mockResolvedValue(user);
      (assertRole as jest.Mock).mockImplementation(() => {});
      (ctx.db.get as jest.Mock).mockResolvedValue({ _id: 'tenant_2', orgId: 'org_other' });

      await expect(tenantsMod.generateQrCode(ctx, { tenantId: 'tenant_2' }))
        .rejects
        .toThrow('Tenant not found or access denied');

      expect(QRCode.toDataURL).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });
  });
});
/**
 * Additional edge-case and failure-path tests.
 * Detected testing framework: Jest (+ ts-jest). These tests reuse existing mocks and module wiring.
 * We purposely do not re-mock modules here to avoid duplicate mock declarations.
 */

describe('convex/tenants server functions - additional cases', () => {
  // Local ctx for this describe; reuse the same DB surface mocked in the original suite.
  let ctx: { db: { insert: jest.Mock, patch: jest.Mock, get: jest.Mock, query: jest.Mock<any, any> } };

  beforeEach(() => {
    jest.clearAllMocks();

    // Provide a fresh ctx.db mock each test with the chained query().withIndex().unique() API.
    const unique = jest.fn();
    const withIndex = jest.fn().mockReturnValue({ unique });
    const query = jest.fn().mockReturnValue({ withIndex });

    ctx = {
      db: {
        insert: jest.fn(),
        patch: jest.fn(),
        get: jest.fn(),
        query,
      },
    };
  });

  describe('createTenant - edge cases', () => {
    test('propagates Clerk.createOrganization errors and avoids any DB writes', async () => {
      const user = { _id: 'uX', clerkId: 'user_123', roles: [] };
      (getUser as jest.Mock).mockResolvedValue(user);

      const clerkInstance = Clerk();
      (clerkInstance.organizations.createOrganization as jest.Mock)
        .mockRejectedValue(new Error('clerk org failure'));

      await expect(tenantsMod.createTenant(ctx, { name: 'BadCo' }))
        .rejects.toThrow('clerk org failure');

      expect(clerkInstance.organizations.createOrganizationMembership).not.toHaveBeenCalled();
      expect(ctx.db.insert).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });

    test('propagates Clerk.createOrganizationMembership errors and avoids DB writes', async () => {
      const user = { _id: 'uY', clerkId: 'user_456', roles: [] };
      (getUser as jest.Mock).mockResolvedValue(user);

      const clerkInstance = Clerk();
      (clerkInstance.organizations.createOrganization as jest.Mock)
        .mockResolvedValue({ id: 'org_edge' });
      (clerkInstance.organizations.createOrganizationMembership as jest.Mock)
        .mockRejectedValue(new Error('membership failure'));

      await expect(tenantsMod.createTenant(ctx, { name: 'Edge LLC' }))
        .rejects.toThrow('membership failure');

      expect(ctx.db.insert).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe('get - additional cases', () => {
    test('returns null when unique() resolves to null (no tenant for org)', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: [], orgId: 'org_none' });

      const unique = jest.fn().mockResolvedValue(null);
      const withIndex = jest.fn().mockReturnValue({ unique });
      (ctx.db.query as jest.Mock).mockReturnValue({ withIndex });

      const result = await tenantsMod.get(ctx, {});
      expect(ctx.db.query).toHaveBeenCalledWith('tenants');
      expect(withIndex).toHaveBeenCalledWith('by_org_id', expect.any(Function));
      expect(unique).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('propagates rejection if unique() rejects (DB error)', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: [], orgId: 'org_abc' });

      const unique = jest.fn().mockRejectedValue(new Error('db unique failure'));
      const withIndex = jest.fn().mockReturnValue({ unique });
      (ctx.db.query as jest.Mock).mockReturnValue({ withIndex });

      await expect(tenantsMod.get(ctx, {})).rejects.toThrow('db unique failure');
    });
  });

  describe('generateQrCode - error paths', () => {
    test('throws when assertRole denies access and avoids DB/QR operations', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: ['member'], orgId: 'org_abc' });
      (assertRole as jest.Mock).mockImplementation(() => { throw new Error('unauthorized'); });

      await expect(tenantsMod.generateQrCode(ctx, { tenantId: 'tenant_forbidden' }))
        .rejects.toThrow('unauthorized');

      expect(ctx.db.get).not.toHaveBeenCalled();
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });

    test('propagates QRCode.toDataURL error and does not patch DB', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: ['admin'], orgId: 'org_abc' });
      (assertRole as jest.Mock).mockImplementation(() => { /* allowed */ });

      const tenantId = 'tenant_qr_err';
      (ctx.db.get as jest.Mock).mockResolvedValue({ _id: tenantId, orgId: 'org_abc', name: 'Acme' });
      (QRCode.toDataURL as jest.Mock).mockRejectedValue(new Error('qr failure'));

      await expect(tenantsMod.generateQrCode(ctx, { tenantId }))
        .rejects.toThrow('qr failure');

      expect(ctx.db.get).toHaveBeenCalledWith(tenantId);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(`/assessment/${tenantId}`);
      expect(ctx.db.patch).not.toHaveBeenCalled();
    });

    test('propagates DB patch error after QR generation', async () => {
      (getUser as jest.Mock).mockResolvedValue({ _id: 'u1', clerkId: 'c1', roles: ['admin'], orgId: 'org_abc' });
      (assertRole as jest.Mock).mockImplementation(() => { /* allowed */ });

      const tenantId = 'tenant_patch_err';
      (ctx.db.get as jest.Mock).mockResolvedValue({ _id: tenantId, orgId: 'org_abc', name: 'Acme' });
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,FAKE_PLUS');
      (ctx.db.patch as jest.Mock).mockRejectedValue(new Error('patch failure'));

      await expect(tenantsMod.generateQrCode(ctx, { tenantId }))
        .rejects.toThrow('patch failure');

      expect(ctx.db.get).toHaveBeenCalledWith(tenantId);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(`/assessment/${tenantId}`);
      expect(ctx.db.patch).toHaveBeenCalledWith(tenantId, { qrCode: 'data:image/png;base64,FAKE_PLUS' });
    });
  });
});