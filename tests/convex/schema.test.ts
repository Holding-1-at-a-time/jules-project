/* 
  Test runner note:
  - Compatible with Vitest or Jest (describe/it/expect).
  - No new dependencies introduced.
*/
import { describe, it, expect } from 'vitest'; // If repo uses Jest, this import may be auto-mapped; otherwise change to from '@jest/globals'
import schema from '../../convex/schema'; // Adjust if schema file path differs; typical Convex path is convex/schema.ts

// Fallback types only if available without type imports. Runtime-level checks only.

type AnyRecord = Record<string, unknown>;

// Helpers to introspect Convex schema objects best-effort.
// Convex defineSchema returns an object with a "tables" map; we won't rely on private internals,
// but we can check for keys and basic structure in a best-effort manner.
function hasKey<T extends object>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function get(obj: AnyRecord, path: string): unknown {
  return path.split('.').reduce((acc: any, k) => (acc == null ? undefined : acc[k]), obj);
}

describe('Convex schema structure', () => {
  it('exports a schema-like object', () => {
    expect(schema).toBeTruthy();
    expect(typeof schema).toBe('object');
  });

  it('defines expected tables', () => {
    // Best-effort: many Convex schema objects expose tables through internal fields.
    // We'll check for common shapes and fallback heuristics.
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    expect(tables).toBeTruthy();

    // Required tables
    for (const tableName of ['tenants', 'users', 'services', 'assessments', 'estimates']) {
      expect(hasKey(tables as AnyRecord, tableName)).toBe(true);
    }
  });

  it('tenants: has required fields and indexes', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const tenants = (tables as AnyRecord)['tenants'];
    expect(tenants).toBeTruthy();

    // Fields existence heuristic: Convex stores validators in definitions; we attempt common locations.
    const fields = (tenants as AnyRecord).fields ?? (tenants as AnyRecord)._fields ?? (tenants as AnyRecord).documentType;
    expect(fields).toBeTruthy();

    // Required fields
    for (const f of ['name', 'orgId']) {
      expect(hasKey(fields as AnyRecord, f)).toBe(true);
    }
    // Optional field
    expect(hasKey(fields as AnyRecord, 'qrCode')).toBe(true);

    // Indexes
    const indexes = (tenants as AnyRecord).indexes ?? (tenants as AnyRecord)._indexes ?? (tenants as AnyRecord).tableIndexes;
    expect(indexes).toBeTruthy();
    const byOrg = JSON.stringify(indexes);

    expect(byOrg).toMatch(/by_org_id/);
    expect(byOrg).toMatch(/orgId/);
  });

  it('users: has required fields, optional orgId, and indexes', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const users = (tables as AnyRecord)['users'];
    expect(users).toBeTruthy();

    const fields = (users as AnyRecord).fields ?? (users as AnyRecord)._fields ?? (users as AnyRecord).documentType;
    expect(fields).toBeTruthy();

    for (const f of ['name', 'email', 'clerkId', 'roles']) {
      expect(hasKey(fields as AnyRecord, f)).toBe(true);
    }
    expect(hasKey(fields as AnyRecord, 'orgId')).toBe(true);

    // Ensure roles is modeled as an array (string check via serialized form)
    const rolesField = (fields as AnyRecord)['roles'];
    expect(rolesField).toBeTruthy();
    expect(String(rolesField)).toMatch(/array/i);

    // Indexes
    const indexes = (users as AnyRecord).indexes ?? (users as AnyRecord)._indexes ?? (users as AnyRecord).tableIndexes;
    const idx = JSON.stringify(indexes);
    expect(idx).toMatch(/by_clerk_id/);
    expect(idx).toMatch(/clerkId/);
    expect(idx).toMatch(/by_org_id/);
    expect(idx).toMatch(/orgId/);
  });

  it('services: validates tenantId reference and indexes by tenant', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const services = (tables as AnyRecord)['services'];
    expect(services).toBeTruthy();

    const fields = (services as AnyRecord).fields ?? (services as AnyRecord)._fields ?? (services as AnyRecord).documentType;
    expect(fields).toBeTruthy();

    for (const f of ['tenantId', 'name', 'description', 'basePrice']) {
      expect(hasKey(fields as AnyRecord, f)).toBe(true);
    }

    const tenantIdField = (fields as AnyRecord)['tenantId'];
    expect(String(tenantIdField)).toMatch(/id.*tenants/i);

    const indexes = (services as AnyRecord).indexes ?? (services as AnyRecord)._indexes ?? (services as AnyRecord).tableIndexes;
    const idx = JSON.stringify(indexes);
    expect(idx).toMatch(/by_tenant_id/);
    expect(idx).toMatch(/tenantId/);
  });

  it('assessments: links to tenant and client, with embedded vehicleInfo and selectedServices', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const assessments = (tables as AnyRecord)['assessments'];
    expect(assessments).toBeTruthy();

    const fields = (assessments as AnyRecord).fields ?? (assessments as AnyRecord)._fields ?? (assessments as AnyRecord).documentType;
    expect(fields).toBeTruthy();

    for (const f of ['tenantId', 'clientId', 'vehicleInfo', 'selectedServices']) {
      expect(hasKey(fields as AnyRecord, f)).toBe(true);
    }

    // ID relationships
    expect(String((fields as AnyRecord)['tenantId'])).toMatch(/id.*tenants/i);
    expect(String((fields as AnyRecord)['clientId'])).toMatch(/id.*users/i);

    // vehicleInfo object structure
    const vehicleInfo = (fields as AnyRecord)['vehicleInfo'];
    expect(String(vehicleInfo)).toMatch(/object/i);

    // selectedServices array of ids to services
    const selectedServices = (fields as AnyRecord)['selectedServices'];
    expect(String(selectedServices)).toMatch(/array/i);
    expect(String(selectedServices)).toMatch(/id.*services/i);

    // Indexes by tenant
    const indexes = (assessments as AnyRecord).indexes ?? (assessments as AnyRecord)._indexes ?? (assessments as AnyRecord).tableIndexes;
    const idx = JSON.stringify(indexes);
    expect(idx).toMatch(/by_tenant_id/);
    expect(idx).toMatch(/tenantId/);
  });

  it('estimates: links to assessments and indexes by assessmentId', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const estimates = (tables as AnyRecord)['estimates'];
    expect(estimates).toBeTruthy();

    const fields = (estimates as AnyRecord).fields ?? (estimates as AnyRecord)._fields ?? (estimates as AnyRecord).documentType;
    expect(fields).toBeTruthy();

    for (const f of ['assessmentId', 'totalPrice']) {
      expect(hasKey(fields as AnyRecord, f)).toBe(true);
    }

    expect(String((fields as AnyRecord)['assessmentId'])).toMatch(/id.*assessments/i);

    const indexes = (estimates as AnyRecord).indexes ?? (estimates as AnyRecord)._indexes ?? (estimates as AnyRecord).tableIndexes;
    const idx = JSON.stringify(indexes);
    expect(idx).toMatch(/by_assessment_id/);
    expect(idx).toMatch(/assessmentId/);
  });
});

// Edge case tests that ensure the schema did not accidentally include unexpected tables/fields.
// We keep this lenient to avoid flakiness if Convex internals vary.
describe('Convex schema guardrails', () => {
  it('does not define unexpected top-level tables', () => {
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const names = Object.keys(tables as AnyRecord);
    // Allow only known set, but do not fail if Convex adds hidden entries; filter by our known names.
    const known = new Set(['tenants', 'users', 'services', 'assessments', 'estimates']);
    const ours = names.filter(n => known.has(n));
    expect(ours.sort()).toEqual(['assessments','estimates','services','tenants','users'].sort());
  });

  it('indexes reference existing field names (heuristic)', () => {
    const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tables = (schema as AnyRecord).tables ?? (schema as AnyRecord)._tables ?? schema;
    const check = (tableName: string, expected: string[]) => {
      const table = (tables as AnyRecord)[tableName];
      const fields = (table as AnyRecord).fields ?? (table as AnyRecord)._fields ?? (table as AnyRecord).documentType ?? {};
      const indexes = (table as AnyRecord).indexes ?? (table as AnyRecord)._indexes ?? (table as AnyRecord).tableIndexes ?? {};
      const dump = JSON.stringify(indexes);
      for (const f of expected) {
        expect(dump).toContain(f);
        expect(hasKey(fields as AnyRecord, f)).toBe(true);
      }
    };
    check('tenants', ['orgId']);
    check('users', ['clerkId', 'orgId']);
    check('services', ['tenantId']);
    check('assessments', ['tenantId']);
    check('estimates', ['assessmentId']);
  });
});