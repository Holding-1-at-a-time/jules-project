import './__setup__';

describe("Convex schema structure", () => {
  // We will dynamically import the schema file after setting up module mocks so that
  // the code under test picks up our mock for 'convex/server' and 'convex/values'.
  // We don't know the exact path of the schema file from the repository snippet.
  // Try common locations in order; the first successful import wins.
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

  // These variables are populated by the mock below
  let recordedTables: Record<string, TableRecord> = {};

  // Build a manual mock for convex/server
  const makeConvexServerMock = () => {
    const tables: Record<string, TableRecord> = {};
    const defineTable = (fields: Record<string, any>) => {
      const rec: TableRecord = { fields, indexes: [] };
      // Return a chainable builder with .index; users may chain multiple .index calls
      const builder = {
        index: (name: string, fields: string[]) => {
          rec.indexes.push({ name, fields });
          return builder;
        },
        // Allow reading back in tests if needed
        _record: rec,
      };
      // Keep a weak reference until defineSchema binds it to a table name
      // We return the builder here; defineSchema will receive builders.
      return builder;
    };

    const defineSchema = (obj: Record<string, any>) => {
      // obj is a map: tableName -> builder
      Object.entries(obj).forEach(([name, builder]: [string, any]) => {
        const rec: TableRecord = builder && builder._record ? builder._record : { fields: {}, indexes: [] };
        tables[name] = rec;
      });
      return { tables }; // minimal facade
    };

    return { defineSchema, defineTable, __tables: tables };
  };

  // Minimal mock for convex/values that tags validator constructors
  const makeConvexValuesMock = () => {
    const tag = (t: string) => Object.assign((() => null) as any, { __v: t });
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

  // Install mocks using jest or vitest (available via our shim)
  beforeAll(() => {
    const serverMock = makeConvexServerMock();
    const valuesMock = makeConvexValuesMock();

    // @ts-ignore
    vi.mock?.("convex/server", () => serverMock);
    // @ts-ignore
    vi.mock?.("convex/values", () => valuesMock);

    // Capture tables after schema import
    recordedTables = serverMock.__tables;
  });

  // Helper to import the schema module from one of the candidate paths
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
    throw new Error(`Could not import schema from any known path. Tried: ${candidatePaths.join(", ")}. Last error: ${String(lastErr)}`);
  }

  test("schema defines all expected tables", async () => {
    await importSchemaFromCandidates();
    expect(Object.keys(recordedTables).sort()).toEqual(
      ["assessments", "estimates", "services", "tenants", "users"].sort()
    );
  });

  test("tenants table: fields and by_org_id index", async () => {
    await importSchemaFromCandidates();
    const t = recordedTables["tenants"];
    expect(t).toBeDefined();
    expect(Object.keys(t.fields).sort()).toEqual(["name", "orgId", "qrCode"].sort());
    expect(t.fields.name.__v).toBe("string");
    expect(t.fields.orgId.__v).toBe("string");
    expect(t.fields.qrCode.__v).toBe("optional");
    expect(t.fields.qrCode.of.__v).toBe("string");
    expect(t.indexes).toContainEqual({ name: "by_org_id", fields: ["orgId"] });
  });

  test("users table: fields, required/optional, and indexes", async () => {
    await importSchemaFromCandidates();
    const u = recordedTables["users"];
    expect(u).toBeDefined();

    // Validate keys
    expect(Object.keys(u.fields).sort()).toEqual(["clerkId", "email", "name", "orgId", "roles"].sort());

    // Field types
    expect(u.fields.name.__v).toBe("string");
    expect(u.fields.email.__v).toBe("string");
    expect(u.fields.clerkId.__v).toBe("string");

    // Optional orgId
    expect(u.fields.orgId.__v).toBe("optional");
    expect(u.fields.orgId.of.__v).toBe("string");

    // roles is array of strings
    expect(u.fields.roles.__v).toBe("array");
    expect(u.fields.roles.of.__v).toBe("string");

    // Indexes
    expect(u.indexes).toEqual(
      expect.arrayContaining([
        { name: "by_clerk_id", fields: ["clerkId"] },
        { name: "by_org_id", fields: ["orgId"] },
      ])
    );
  });

  test("services table: tenantId foreign key, pricing, and index", async () => {
    await importSchemaFromCandidates();
    const s = recordedTables["services"];
    expect(s).toBeDefined();

    expect(Object.keys(s.fields).sort()).toEqual(["basePrice", "description", "name", "tenantId"].sort());

    expect(s.fields.tenantId.__v).toBe("id:tenants");
    expect(s.fields.name.__v).toBe("string");
    expect(s.fields.description.__v).toBe("string");
    expect(s.fields.basePrice.__v).toBe("number");

    expect(s.indexes).toContainEqual({ name: "by_tenant_id", fields: ["tenantId"] });
  });

  test("assessments table: client linkage, vehicleInfo shape, selectedServices, and index", async () => {
    await importSchemaFromCandidates();
    const a = recordedTables["assessments"];
    expect(a).toBeDefined();

    expect(Object.keys(a.fields).sort()).toEqual(
      ["tenantId", "clientId", "vehicleInfo", "selectedServices"].sort()
    );

    expect(a.fields.tenantId.__v).toBe("id:tenants");
    expect(a.fields.clientId.__v).toBe("id:users");

    // vehicleInfo is object with specific shape
    expect(a.fields.vehicleInfo.__v).toBe("object");
    const shape = a.fields.vehicleInfo.shape;
    expect(Object.keys(shape).sort()).toEqual(["make", "model", "vin", "year"].sort());
    expect(shape.vin.__v).toBe("string");
    expect(shape.make.__v).toBe("string");
    expect(shape.model.__v).toBe("string");
    expect(shape.year.__v).toBe("number");

    // selectedServices is array of id('services')
    expect(a.fields.selectedServices.__v).toBe("array");
    expect(a.fields.selectedServices.of.__v).toBe("id:services");

    expect(a.indexes).toContainEqual({ name: "by_tenant_id", fields: ["tenantId"] });
  });

  test("estimates table: assessmentId link and index", async () => {
    await importSchemaFromCandidates();
    const e = recordedTables["estimates"];
    expect(e).toBeDefined();
    expect(Object.keys(e.fields).sort()).toEqual(["assessmentId", "totalPrice"].sort());
    expect(e.fields.assessmentId.__v).toBe("id:assessments");
    expect(e.fields.totalPrice.__v).toBe("number");
    expect(e.indexes).toContainEqual({ name: "by_assessment_id", fields: ["assessmentId"] });
  });

  test("defensive: unexpected inputs should not break our mock contract", async () => {
    // This test ensures our mocks are robust; it doesn't import schema.
    const { defineSchema, defineTable }: any = (() => {
      const s = makeConvexServerMock();
      return s;
    })();

    const builder = defineTable({ foo: { __v: "string" } });
    // chain multiple index calls
    builder.index("a", ["x"]).index("b", ["y"]);
    const res = defineSchema({ fooTable: builder });
    expect(res.tables.fooTable.indexes.map((i: any) => i.name).sort()).toEqual(["a", "b"]);
  });
});

// Local setup to ensure vi is available and mocks work across Jest/Vitest
// This imports the vi-jest shim and configures test framework globals per repo conventions.
export {};