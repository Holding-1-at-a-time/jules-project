import "./__setup__";

/**
 * Additional schema contract tests
 * Framework: Vitest (vi.* globals via repo shim)
 *
 * These tests run in a separate file to avoid interfering with the original
 * describe-block's mocking lifecycle. They re-install light mocks and validate
 * stricter contracts and edge cases.
 */

describe("Convex schema stricter contracts", () => {
  // Try common locations; first successful import wins.
  const candidatePaths = [
    "convex/schema",
    "./convex/schema",
    "src/convex/schema",
    "./src/convex/schema",
    "app/convex/schema",
    "./app/convex/schema",
  ];

  type IndexDef = { name: string; fields: string[] };
  type TableRecord = { fields: Record<string, any>; indexes: IndexDef[] };

  // Populated from the convex/server mock
  let recordedTables: Record<string, TableRecord> = {};

  // convex/server mock
  const makeConvexServerMock = () => {
    const tables: Record<string, TableRecord> = {};
    const defineTable = (fields: Record<string, any>) => {
      const rec: TableRecord = { fields, indexes: [] };
      const builder = {
        index: (name: string, fields: string[]) => {
          rec.indexes.push({ name, fields });
          return builder;
        },
        _record: rec,
      };
      return builder;
    };

    const defineSchema = (obj: Record<string, any>) => {
      Object.entries(obj).forEach(([name, builder]: [string, any]) => {
        const rec: TableRecord = builder && builder._record ? builder._record : { fields: {}, indexes: [] };
        tables[name] = rec;
      });
      return { tables };
    };

    return { defineSchema, defineTable, __tables: tables };
  };

  // convex/values mock
  const makeConvexValuesMock = () => {
    const v = {
      string: () => ({ __v: "string" }),
      number: () => ({ __v: "number" }),
      id: (table: string) => ({ __v: `id:${table}` }),
      array: (inner: any) => ({ __v: "array", of: inner }),
      object: (shape: Record<string, any>) => ({ __v: "object", shape }),
      optional: (inner: any) => ({ __v: "optional", of: inner }),
    };
    return { v };
  };

  beforeAll(() => {
    const serverMock = makeConvexServerMock();
    const valuesMock = makeConvexValuesMock();

    // @ts-ignore - available via vitest or shim
    vi.mock?.("convex/server", () => serverMock);
    // @ts-ignore
    vi.mock?.("convex/values", () => valuesMock);

    recordedTables = serverMock.__tables;
  });

  async function importSchemaFromCandidates() {
    let lastErr: any;
    for (const p of candidatePaths) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await import(p);
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    throw new Error(
      `Could not import schema from any known path. Tried: ${candidatePaths.join(
        ", "
      )}. Last error: ${String(lastErr)}`
    );
  }

  test("module exports a schema-like object (default or named) with tables", async () => {
    const mod: any = await importSchemaFromCandidates();
    const candidates = [mod, mod?.default, mod?.schema].filter(Boolean);
    const exported = candidates.find((m: any) => m && typeof m === "object" && "tables" in m);
    expect(exported).toBeTruthy();
    expect(Object.keys((exported as any).tables).sort()).toEqual(Object.keys(recordedTables).sort());
  });

  test("tenants: exact index set (no extras)", async () => {
    await importSchemaFromCandidates();
    const t = recordedTables["tenants"];
    expect(t).toBeDefined();
    expect(t.indexes.map((i) => i.name).sort()).toEqual(["by_org_id"]);
  });

  test("users: exact index set (no extras)", async () => {
    await importSchemaFromCandidates();
    const u = recordedTables["users"];
    expect(u).toBeDefined();
    expect(u.indexes.map((i) => i.name).sort()).toEqual(["by_clerk_id", "by_org_id"].sort());
  });

  test("services: exact index set (no extras)", async () => {
    await importSchemaFromCandidates();
    const s = recordedTables["services"];
    expect(s).toBeDefined();
    expect(s.indexes.map((i) => i.name).sort()).toEqual(["by_tenant_id"]);
  });

  test("assessments: exact index set (no extras)", async () => {
    await importSchemaFromCandidates();
    const a = recordedTables["assessments"];
    expect(a).toBeDefined();
    expect(a.indexes.map((i) => i.name).sort()).toEqual(["by_tenant_id"]);
  });

  test("estimates: exact index set (no extras)", async () => {
    await importSchemaFromCandidates();
    const e = recordedTables["estimates"];
    expect(e).toBeDefined();
    expect(e.indexes.map((i) => i.name).sort()).toEqual(["by_assessment_id"]);
  });

  test("users: required vs optional fields are correctly marked", async () => {
    await importSchemaFromCandidates();
    const u = recordedTables["users"];
    const isOptional = (f: any) => f && f.__v === "optional";
    expect(isOptional(u.fields.name)).toBe(false);
    expect(isOptional(u.fields.email)).toBe(false);
    expect(isOptional(u.fields.clerkId)).toBe(false);
    // roles is array, not optional
    expect(u.fields.roles.__v).toBe("array");
    expect(isOptional(u.fields.roles)).toBe(false);
    // orgId is optional string
    expect(isOptional(u.fields.orgId)).toBe(true);
    expect(u.fields.orgId.of.__v).toBe("string");
  });

  test("tenants: required vs optional fields are correctly typed", async () => {
    await importSchemaFromCandidates();
    const t = recordedTables["tenants"];
    expect(t.fields.name.__v).toBe("string");
    expect(t.fields.orgId.__v).toBe("string");
    expect(t.fields.qrCode.__v).toBe("optional");
    expect(t.fields.qrCode.of.__v).toBe("string");
  });

  test("builder chaining returns same instance and persists multiple indexes", () => {
    const { defineTable, defineSchema }: any = (() => {
      const s = makeConvexServerMock();
      return s;
    })();

    const builder = defineTable({ foo: { __v: "string" } });
    const chained = builder.index("x", ["foo"]).index("y", ["foo"]);
    expect(chained).toBe(builder);

    const res = defineSchema({ foo: builder });
    expect(res.tables.foo.indexes.map((i: any) => i.name).sort()).toEqual(["x", "y"]);
  });

  test("edge case: table with empty fields still records indexes via builder", () => {
    const { defineTable, defineSchema }: any = (() => {
      const s = makeConvexServerMock();
      return s;
    })();

    const builder = defineTable({});
    builder.index("idx", []);
    const res = defineSchema({ empty: builder });

    expect(Object.keys(res.tables.empty.fields)).toEqual([]);
    expect(res.tables.empty.indexes).toEqual([{ name: "idx", fields: [] }]);
  });
});

export {};