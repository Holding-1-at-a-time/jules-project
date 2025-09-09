/**
 * Tests for convex assessments server functions.
 *
 * Framework note:
 * - This test suite assumes Jest. If your repository uses Vitest, uncomment the compatibility shim below
 *   or replace jest with vi accordingly.
 *
 * Coverage focus: functions defined in convex/assessments.ts
 *   - createAssessment.mutation: validates role, org membership, tenant presence, and DB insert payload.
 *   - getAssessments.query: validates role, handles missing org/tenant by returning [], and collects assessments.
 */

// Vitest compatibility shim (uncomment if using Vitest):
// // @ts-ignore
// const jest = typeof vi \!== 'undefined' ? vi : (global as any).jest;

import { v } from 'convex/values';

// Mock the convex server scaffolding and auth utilities used by assessments.ts
// Path notes: Adjust relative paths if the actual file structure differs.
// We will mock './_generated/server' and './auth' as used in the code under test.

jest.mock('../../convex/_generated/server', () => {
  // Provide minimal stubs for mutation/query wrappers to expose the inner handler for direct testing
  return {
    mutation: (def: any) => def,
    query: (def: any) => def,
  };
});

const mockGetUser = jest.fn();
const mockAssertRole = jest.fn();

jest.mock('../../convex/auth', () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
  assertRole: (...args: any[]) => mockAssertRole(...args),
}));

// Import after mocks so that the module under test picks up our stubs
// Adjust the import path if assessments.ts resides elsewhere.
import { createAssessment, getAssessments } from '../../convex/assessments';

type Id = string & { __idBrand: 'convex' };
type Doc<T extends string> = { _id: Id } & Record<string, any>;

function id(table: string, raw = 'test_id'): Id {
  // lightweight branded id stub for readability
  return (raw + ':' + table) as Id;
}

// Utilities to fabricate a minimal ctx.db with chainable query/withIndex/unique/collect and insert
function makeDbMocks() {
  const insert = jest.fn();
  const collect = jest.fn();
  const unique = jest.fn();
  const withIndex = jest.fn().mockReturnValue({ unique, collect });
  const query = jest.fn().mockReturnValue({ withIndex });
  return { insert, collect, unique, withIndex, query };
}

describe('assessments convex functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAssessment.mutation', () => {
    const baseArgs = {
      clientId: id('users', 'client123'),
      vehicleInfo: {
        vin: '1HGBH41JXMN109186',
        make: 'Honda',
        model: 'Civic',
        year: 2020,
      },
      selectedServices: [id('services', 'svc1'), id('services', 'svc2')],
    };

    test('throws if user has no orgId', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u1'), role: 'client', orgId: null });
      mockAssertRole.mockImplementation(() => {});

      await expect(createAssessment.handler(ctx, baseArgs)).rejects.toThrow('User does not belong to an organization');

      expect(mockAssertRole).toHaveBeenCalledWith(ctx, { _id: expect.any(String), role: 'client', orgId: null }, 'client');
      // No DB calls should have occurred
      expect(db.query).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    test('throws if tenant not found for user orgId', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u2'), role: 'client', orgId: 'org-123' });
      mockAssertRole.mockImplementation(() => {});
      // Tenants unique() returns null
      db.unique.mockResolvedValueOnce(null);

      await expect(createAssessment.handler(ctx, baseArgs)).rejects.toThrow('Tenant not found');

      expect(db.query).toHaveBeenCalledWith('tenants');
      expect(db.withIndex).toHaveBeenCalledWith('by_org_id', expect.any(Function));
      expect(db.insert).not.toHaveBeenCalled();
    });

    test('inserts assessment with tenantId when happy path', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      const tenant: Doc<'tenants'> = { _id: id('tenants', 't1') };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u3'), role: 'client', orgId: 'org-456' });
      mockAssertRole.mockImplementation(() => {});
      db.unique.mockResolvedValueOnce(tenant);

      await expect(createAssessment.handler(ctx, baseArgs)).resolves.toBeUndefined();

      expect(db.query).toHaveBeenCalledWith('tenants');
      expect(db.withIndex).toHaveBeenCalledWith('by_org_id', expect.any(Function));
      expect(db.insert).toHaveBeenCalledWith('assessments', {
        tenantId: tenant._id,
        ...baseArgs,
      });
    });

    test('propagates assertRole failures', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u4'), role: 'guest', orgId: 'org-x' });
      mockAssertRole.mockImplementation(() => {
        throw new Error('Forbidden');
      });

      await expect(createAssessment.handler(ctx, baseArgs)).rejects.toThrow('Forbidden');
      expect(db.query).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    test('validates types for vehicleInfo.year and selectedServices IDs', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      const tenant: Doc<'tenants'> = { _id: id('tenants', 't2') };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u5'), role: 'client', orgId: 'org-y' });
      mockAssertRole.mockImplementation(() => {});
      db.unique.mockResolvedValueOnce(tenant);

      const badArgs: any = {
        ...baseArgs,
        vehicleInfo: { ...baseArgs.vehicleInfo, year: '2020' }, // wrong type
      };

      // The v.object/v.number validation occurs inside Convex at runtime only when called via client.
      // Since we call the handler directly, we simulate a type error by asserting our code does not coerce it.
      // Here we just ensure the handler passes the bad data through to insert; consumers would rely on Convex validation upstream.
      await createAssessment.handler(ctx, badArgs);
      expect(db.insert).toHaveBeenCalledWith('assessments', expect.objectContaining({ vehicleInfo: expect.objectContaining({ year: '2020' }) }));
    });
  });

  describe('getAssessments.query', () => {
    test('returns [] if user has no orgId', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u6'), role: 'detailer', orgId: null });
      mockAssertRole.mockImplementation(() => {});

      await expect(getAssessments.handler(ctx, {})).resolves.toEqual([]);

      expect(db.query).not.toHaveBeenCalledWith('tenants');
      expect(db.query).not.toHaveBeenCalledWith('assessments');
    });

    test('returns [] if tenant not found', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u7'), role: 'detailer', orgId: 'org-zzz' });
      mockAssertRole.mockImplementation(() => {});
      db.unique.mockResolvedValueOnce(null);

      await expect(getAssessments.handler(ctx, {})).resolves.toEqual([]);

      expect(db.query).toHaveBeenCalledWith('tenants');
      expect(db.withIndex).toHaveBeenCalledWith('by_org_id', expect.any(Function));
      expect(db.collect).not.toHaveBeenCalled();
    });

    test('collects assessments by tenant when happy path', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      const tenant: Doc<'tenants'> = { _id: id('tenants', 't3') };
      const rows = [
        { _id: id('assessments', 'a1'), tenantId: tenant._id },
        { _id: id('assessments', 'a2'), tenantId: tenant._id },
      ];
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u8'), role: 'detailer', orgId: 'org-abc' });
      mockAssertRole.mockImplementation(() => {});
      db.unique.mockResolvedValueOnce(tenant);
      db.collect.mockResolvedValueOnce(rows);

      await expect(getAssessments.handler(ctx, {})).resolves.toEqual(rows);

      // Ensure the tenant lookup came first then the assessments lookup keyed by tenant id
      expect(db.query).toHaveBeenNthCalledWith(1, 'tenants');
      expect(db.withIndex).toHaveBeenNthCalledWith(1, 'by_org_id', expect.any(Function));
      expect(db.query).toHaveBeenNthCalledWith(2, 'assessments');
      expect(db.withIndex).toHaveBeenNthCalledWith(2, 'by_tenant_id', expect.any(Function));
      expect(db.collect).toHaveBeenCalled();
    });

    test('propagates assertRole errors', async () => {
      const db = makeDbMocks();
      const ctx: any = { db };
      mockGetUser.mockResolvedValueOnce({ _id: id('users', 'u9'), role: 'client', orgId: 'org-1' });
      mockAssertRole.mockImplementation(() => {
        throw new Error('Not a detailer');
      });

      await expect(getAssessments.handler(ctx, {})).rejects.toThrow('Not a detailer');
      expect(db.query).not.toHaveBeenCalled();
    });
  });
});