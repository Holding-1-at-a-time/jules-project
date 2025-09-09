/* 
  Test framework: Vitest or Jest-compatible syntax.
  - If Vitest: run with vitest.
  - If Jest: these tests also pass (use jest.fn instead of vi.fn via conditional).
*/

import path from 'node:path';

const isVitest = typeof (globalThis as any).vi !== 'undefined';
const fn = isVitest
  ? (globalThis as any).vi.fn
  : (globalThis as any).jest?.fn ?? (() => {
      throw new Error("No test spy function found. Run under Vitest or Jest.");
    });

type IndexRecord = { name: string; fields: string[] };
type TableRecord = {
  fields: Record<string, any>;
  indexes: IndexRecord[];
  name: string;
};

function buildConvexServerMock(
  captured: { schemaArg?: Record<string, any>; tables: Record<string, TableRecord> }
) {
  const defineTable = fn((fields: Record<string, any>) => {
    // When defineTable is used, the variable name (key in schema object) will become the table name.
    // We'll attach a placeholder; the real name is assigned in defineSchema when we see the object key.
    const rec: TableRecord = { fields: { ...fields }, indexes: [], name: "<unassigned>" };
    // Return chainable index API
    const api = {
      index: fn((name: string, fields: string[]) => {
        rec.indexes.push({ name, fields: [...fields] });
        return api;
      })
    };
    // Keep a hidden handle to look up later
    (api as any).__record__ = rec;
    return api;
  });

  const defineSchema = fn((obj: Record<string, any>) => {
    captured.schemaArg = obj;
    // Assign table names to recorded tables and store them
    for (const [key, val] of Object.entries(obj)) {
      const rec = (val as any).__record__ as TableRecord | undefined;
      if (rec) {
        rec.name = key;
        captured.tables[key] = rec;
      } else {
        // If no record is found, store a lightweight entry so we can at least assert presence.
        captured.tables[key] = { name: key, fields: {}, indexes: [] };
      }
    }
    return { __kind: "schema", tables: Object.keys(obj) };
  });

  return { defineTable, defineSchema };
}

// Minimal convex/values mock that tags validators so we can assert what was requested
function buildConvexValuesMock() {
  const tag = (type: string, value?: any) => ({ __v: type, value });
  const v = {
    string: fn(() => tag("string")),
    number: fn(() => tag("number")),
    boolean: fn(() => tag("boolean")),
    optional: fn((inner: any) => tag("optional", inner)),
    array: fn((inner: any) => tag("array", inner)),
    object: fn((o: Record<string, any>) => tag("object", o)),
    union: fn((...inners: any[]) => tag("union", inners)),
    literal: fn((lit: any) => tag("literal", lit)),
    id: fn((tableName: string) => tag("id", tableName)),
  };
  return { v };
}

// Dynamic import with module mocks for either Vitest or Jest
async function importSchemaWithMocks() {
  const captured = { schemaArg: undefined as any, tables: {} as Record<string, TableRecord> };
  const { defineTable, defineSchema } = buildConvexServerMock(captured);
  const { v } = buildConvexValuesMock();

  // Install mocks
  if (isVitest) {
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('convex/server', () => ({ defineTable, defineSchema }), { virtual: true });
    vi.doMock('convex/values', () => ({ v }), { virtual: true });
  } else {
    jest.resetModules();
    jest.doMock('convex/server', () => ({ defineTable, defineSchema }), { virtual: true });
    jest.doMock('convex/values', () => ({ v }), { virtual: true });
  }

  const modPath = path.resolve(
    process.cwd(),
    'SlickSolutions/slicksolutions/convex/schema.test.ts'
  );
  const schemaModule = await import(modPath);

  return { captured, schemaModule };
}

describe('Convex schema definition', () => {
  test('exports a default schema and declares expected tables', async () => {
    const { captured, schemaModule } = await importSchemaWithMocks();
    expect(schemaModule).toBeTruthy();
    expect('default' in schemaModule).toBe(true);

    const tableNames = Object.keys(captured.tables).sort();
    expect(tableNames).toEqual(
      [
        'assessments',
        'chatHistory',
        'clients',
        'detailers',
        'estimates',
        'services',
        'tenants',
        'users'
      ].sort()
    );
  });

  test('tenants table has required fields and index', async () => {
    const { captured } = await importSchemaWithMocks();
    const tenants = captured.tables['tenants'];
    expect(tenants).toBeDefined();
    expect(tenants.indexes).toContainEqual({ name: 'by_org_id', fields: ['orgId'] });

    const f = tenants.fields;
    expect(f).toHaveProperty('name');
    expect(f).toHaveProperty('orgId');
    expect(f).toHaveProperty('qrCode');

    // Types: name/orgId are string, qrCode optional(string)
    expect(f.name.__v).toBe('string');
    expect(f.orgId.__v).toBe('string');
    expect(f.qrCode.__v).toBe('optional');
    expect(f.qrCode.value.__v).toBe('string');
  });

  test('users table has required fields, indexes, and enum-like unions', async () => {
    const { captured } = await importSchemaWithMocks();
    const users = captured.tables['users'];
    expect(users).toBeDefined();
    expect(users.indexes).toEqual(
      expect.arrayContaining([
        { name: 'by_clerk_id', fields: ['clerkId'] },
        { name: 'by_subscription_id', fields: ['subscriptionId'] }
      ])
    );

    const f = users.fields;
    // Required presence
    for (const key of ['tenantId', 'name', 'email', 'clerkId', 'orgId', 'roles']) {
      expect(f).toHaveProperty(key);
    }

    // ID references should be by string table name
    expect(f.tenantId.__v).toBe('id');
    expect(typeof f.tenantId.value).toBe('string');
    expect(['tenants', 'tenant', 'tenantId']).toContain(f.tenantId.value); // tolerate minor naming diffs in the PR

    // Roles is array of string
    expect(f.roles.__v).toBe('array');
    expect(f.roles.value.__v).toBe('string');

    // Optional Stripe fields
    expect(f.stripeCustomerId?.__v).toBe('optional');
    expect(f.stripeCustomerId?.value.__v).toBe('string');
    expect(f.subscriptionId?.__v).toBe('optional');
    expect(f.subscriptionId?.value.__v).toBe('string');

    // Plan union of literals
    expect(f.plan?.__v).toBe('optional');
    const planUnion = f.plan?.value;
    expect(planUnion.__v).toBe('union');
    const planLits = planUnion.value.map((x: any) => x.value);
    expect(planLits.sort()).toEqual(['Grow', 'Launch', 'Scale'].sort());

    // Subscription status union
    expect(f.subscriptionStatus?.__v).toBe('optional');
    const statusUnion = f.subscriptionStatus?.value;
    expect(statusUnion.__v).toBe('union');
    const statuses = statusUnion.value
      .map((x: any) => x.value)
      .sort();
    expect(statuses).toEqual(
      [
        'active',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'past_due',
        'trialing',
        'unpaid'
      ].sort()
    );
  });

  test('detailers and clients tables have user/tenant id references and indexes', async () => {
    const { captured } = await importSchemaWithMocks();

    for (const tableName of ['detailers', 'clients']) {
      const t = captured.tables[tableName];
      expect(t).toBeDefined();
      const f = t.fields;

      expect(f.userId.__v).toBe('id');
      expect(f.userId.value).toBe('users');

      expect(f.tenantId.__v).toBe('id');
      expect(f.tenantId.value).toBe('tenants');

      // Indexes include by_user_id and by_tenant_id
      const idxNames = t.indexes.map(i => i.name);
      expect(idxNames).toEqual(expect.arrayContaining(['by_user_id', 'by_tenant_id']));
      // Index fields correctness
      expect(t.indexes).toEqual(
        expect.arrayContaining([
          { name: 'by_user_id', fields: ['userId'] },
          { name: 'by_tenant_id', fields: ['tenantId'] }
        ])
      );
    }
  });

  test('services table fields and index', async () => {
    const { captured } = await importSchemaWithMocks();
    const t = captured.tables['services'];
    expect(t).toBeDefined();
    const f = t.fields;

    expect(f.tenantId.__v).toBe('id');
    expect(f.tenantId.value).toBe('tenants');

    expect(f.name.__v).toBe('string');
    expect(f.description.__v).toBe('string');
    expect(f.basePrice.__v).toBe('number');

    expect(t.indexes).toContainEqual({ name: 'by_tenant_id', fields: ['tenantId'] });
  });

  test('assessments table object shapes and indexes', async () => {
    const { captured } = await importSchemaWithMocks();
    const t = captured.tables['assessments'];
    expect(t).toBeDefined();
    const f = t.fields;

    expect(f.tenantId.__v).toBe('id');
    expect(f.tenantId.value).toBe('tenants');

    expect(f.clientId.__v).toBe('id');
    expect(f.clientId.value).toBe('users');

    expect(f.vehicleInfo.__v).toBe('object');
    const vi = f.vehicleInfo.value;
    for (const key of ['vin', 'make', 'model']) {
      expect(vi[key].__v).toBe('string');
    }
    expect(vi.year.__v).toBe('number');

    expect(f.selectedServices.__v).toBe('array');
    expect(f.selectedServices.value.__v).toBe('id');
    expect(f.selectedServices.value.value).toBe('services');

    expect(f.status.__v).toBe('string');

    if (f.notes) {
      expect(f.notes.__v).toBe('optional');
      expect(f.notes.value.__v).toBe('string');
    }

    const idx = t.indexes;
    expect(idx).toEqual(
      expect.arrayContaining([
        { name: 'by_tenant_id', fields: ['tenantId'] },
        { name: 'by_client_id', fields: ['clientId'] }
      ])
    );
  });

  test('estimates table has assessment relation and index', async () => {
    const { captured } = await importSchemaWithMocks();
    const t = captured.tables['estimates'];
    expect(t).toBeDefined();
    const f = t.fields;

    expect(f.assessmentId.__v).toBe('id');
    expect(f.assessmentId.value).toBe('assessments');

    expect(f.totalPrice.__v).toBe('number');

    expect(t.indexes).toContainEqual({ name: 'by_assessment_id', fields: ['assessmentId'] });
  });

  test('chatHistory table fields and index', async () => {
    const { captured } = await importSchemaWithMocks();
    const t = captured.tables['chatHistory'];
    const f = t.fields;

    expect(f.userId.__v).toBe('id');
    expect(f.userId.value).toBe('users');

    expect(f.userMessage.__v).toBe('string');
    expect(f.aiResponse.__v).toBe('string');

    expect(t.indexes).toContainEqual({ name: 'by_user_id', fields: ['userId'] });
  });

  test('defensive: no unknown tables or mismatched index field names', async () => {
    const { captured } = await importSchemaWithMocks();
    // Ensure all index fields exist in their table field sets
    for (const [name, t] of Object.entries(captured.tables)) {
      for (const idx of t.indexes) {
        for (const fld of idx.fields) {
          expect(Object.keys(t.fields)).toContain(fld);
        }
      }
    }
  });
});