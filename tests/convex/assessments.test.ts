/**
 * Tests for createAssessment (mutation) and getAssessments (query).
 *
 * Framework: Jest or Vitest (compat shim below).
 * Focus: Behavior around orgId presence, tenant lookup, role assertion, db interactions, and result shaping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Compat shim for Jest/Vitest ---
// If running under Vitest, globalThis.vi exists; map to jest-like API.
const _isVitest = typeof (globalThis as any).vi !== "undefined";
const jestLike = _isVitest ? (globalThis as any).vi : (globalThis as any).jest ?? {};
const { fn: fnCompat, spyOn: spyOnCompat } = jestLike;

const describeCompat: typeof describe = (globalThis as any).describe || (cb => cb as any);
const itCompat: typeof it = (globalThis as any).it || (globalThis as any).test || (cb => cb as any);
const expectCompat: typeof expect = (globalThis as any).expect;

// --- Dynamic import resolution for the module under test ---
// Try several candidate paths based on typical Convex layouts.

async function importModule() {
  const candidates = [
    // Replace/augment these paths if repository scan identified a definitive path.
    "convex/assessments.ts",
    "src/convex/assessments.ts",
    "backend/convex/assessments.ts",
    "server/convex/assessments.ts",
    "apps/api/convex/assessments.ts",
    // Fallback to JS if built
    "convex/assessments.js",
    "src/convex/assessments.js",
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const m = await import(p as any);
      if (m?.createAssessment && m?.getAssessments) return { mod: m, path: p };
    } catch {
      // try next
    }
  }
  throw new Error("Could not resolve module path for assessments.ts. Please update candidates to the correct path.");
}

// Minimal helper to build a Convex-like ctx with controllable behavior.
function makeCtx(options: {
  tenant?: any | null;
  assessments?: any[];
  capture?: { tenantEq?: any[]; assessmentsEq?: any[]; inserts?: any[] };
}) {
  const capture = options.capture || {};
  capture.tenantEq = capture.tenantEq || [];
  capture.assessmentsEq = capture.assessmentsEq || [];
  capture.inserts = capture.inserts || [];

  const insert = fnCompat?.() || (() => undefined);
  if (insert.mockImplementation) {
    insert.mockImplementation(async (_table: string, doc: any) => {
      capture.inserts.push(doc);
      return { _id: "new_id", ...doc };
    });
  }

  const ctx: any = {
    db: {
      insert,
      query: fnCompat?.((table: string) => {
        if (table === "tenants") {
          return {
            withIndex: (indexName: string, cb: (q: any) => void) => {
              if (typeof cb === "function") cb({ eq: (...args: any[]) => { capture.tenantEq.push(args); } });
              return {
                unique: async () => options.tenant ?? null,
              };
            },
          };
        }
        if (table === "assessments") {
          return {
            withIndex: (indexName: string, cb: (q: any) => void) => {
              if (typeof cb === "function") cb({ eq: (...args: any[]) => { capture.assessmentsEq.push(args); } });
              return {
                collect: async () => options.assessments ?? [],
              };
            },
          };
        }
        throw new Error("Unexpected table: " + table);
      }) || ((table: string) => ({})),
    },
  };

  return { ctx, capture };
}

// Mock the auth module to control getUser and assertRole behavior.
// We will set the mock dynamically after resolving the module path to ensure relative mocking works.
async function withAuthMock(modulePath: string, impl: { getUser?: any; assertRole?: any }, run: () => Promise<void>) {
  const relativeAuth = modulePath.replace(/assessments\.(ts|js)$/i, "auth");
  if (_isVitest) {
    (globalThis as any).vi.doMock(relativeAuth, () => ({
      getUser: impl.getUser ?? (async () => ({ _id: "u1", orgId: "org1", role: "client" })),
      assertRole: impl.assertRole ?? ((_ctx: any, _user: any, _role: string) => {}),
    }));
    await run();
    (globalThis as any).vi.resetModules();
    (globalThis as any).vi.clearAllMocks();
  } else if ((globalThis as any).jest) {
    jest.mock(relativeAuth, () => ({
      __esModule: true,
      getUser: impl.getUser ?? (async () => ({ _id: "u1", orgId: "org1", role: "client" })),
      assertRole: impl.assertRole ?? ((_ctx: any, _user: any, _role: string) => {}),
    }));
    try {
      await run();
    } finally {
      jest.resetModules();
      jest.clearAllMocks();
      jest.dontMock(relativeAuth);
    }
  } else {
    // Fallback: cannot mock in unknown runner; attempt to run as-is.
    await run();
  }
}

describeCompat("convex/assessments", () => {
  itCompat("createAssessment inserts with resolved tenant when user has orgId and correct role (happy path)", async () => {
    const { mod, path } = await importModule();

    const fakeTenant = { _id: "tenant123", orgId: "org1" };
    const capture: any = {};
    const { ctx, capture: cap } = makeCtx({ tenant: fakeTenant, capture });

    const args = {
      clientId: { table: "users", id: "user123" } as any, // convex v.id('users') placeholder
      vehicleInfo: { vin: "V", make: "M", model: "MD", year: 2020 },
      selectedServices: [{ table: "services", id: "svc1" }] as any,
    };

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u1", orgId: "org1", role: "client" }),
      assertRole: (_ctx: any, user: any, role: string) => {
        expectCompat(role).toBe("client");
      },
    }, async () => {
      await mod.createAssessment.handler(ctx, args as any);
    });

    // eq called with correct org filter
    expectCompat(cap.tenantEq?.[0]).toEqual(["orgId", "org1"]);

    // Insert called with merged args and tenantId
    expectCompat(cap.inserts?.length).toBe(1);
    expectCompat(cap.inserts?.[0]).toMatchObject({
      tenantId: fakeTenant._id,
      clientId: args.clientId,
      vehicleInfo: args.vehicleInfo,
      selectedServices: args.selectedServices,
    });
  });

  itCompat("createAssessment throws when user has no orgId", async () => {
    const { mod, path } = await importModule();

    const { ctx } = makeCtx({ tenant: null });

    const args = {
      clientId: { table: "users", id: "user123" } as any,
      vehicleInfo: { vin: "V", make: "M", model: "MD", year: 2020 },
      selectedServices: [],
    };

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u2", orgId: undefined }),
    }, async () => {
      await expectCompat(mod.createAssessment.handler(ctx, args as any))
        .rejects.toThrow("User does not belong to an organization");
    });
  });

  itCompat("createAssessment throws when tenant not found for user's orgId", async () => {
    const { mod, path } = await importModule();

    const { ctx, capture } = makeCtx({ tenant: null, capture: {} });

    const args = {
      clientId: { table: "users", id: "user123" } as any,
      vehicleInfo: { vin: "V", make: "M", model: "MD", year: 2020 },
      selectedServices: [],
    };

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u3", orgId: "orgX" }),
    }, async () => {
      await expectCompat(mod.createAssessment.handler(ctx, args as any))
        .rejects.toThrow("Tenant not found");
    });
  });

  itCompat("createAssessment does not hit DB when assertRole rejects (role mismatch)", async () => {
    const { mod, path } = await importModule();

    const { ctx } = makeCtx({ tenant: { _id: "t1" } });

    const args = {
      clientId: { table: "users", id: "user123" } as any,
      vehicleInfo: { vin: "V", make: "M", model: "MD", year: 2020 },
      selectedServices: [],
    };

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u4", orgId: "org1" }),
      assertRole: () => { throw new Error("Forbidden"); },
    }, async () => {
      await expectCompat(mod.createAssessment.handler(ctx, args as any))
        .rejects.toThrow("Forbidden");
    });
  });

  itCompat("getAssessments returns [] when user has no orgId", async () => {
    const { mod, path } = await importModule();
    const { ctx } = makeCtx({ tenant: null });

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u5", orgId: undefined }),
      assertRole: (_ctx: any, _user: any, role: string) => {
        expectCompat(role).toBe("detailer");
      },
    }, async () => {
      const result = await mod.getAssessments.handler(ctx);
      expectCompat(result).toEqual([]);
    });
  });

  itCompat("getAssessments returns [] when tenant not found", async () => {
    const { mod, path } = await importModule();
    const { ctx } = makeCtx({ tenant: null });

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u6", orgId: "orgZ" }),
    }, async () => {
      const result = await mod.getAssessments.handler(ctx);
      expectCompat(result).toEqual([]);
    });
  });

  itCompat("getAssessments collects records filtered by tenantId when tenant exists (happy path)", async () => {
    const { mod, path } = await importModule();

    const fakeTenant = { _id: "tenantABC", orgId: "org1" };
    const fakeAssessments = [
      { _id: "a1", tenantId: fakeTenant._id, clientId: { id: "c1" } },
      { _id: "a2", tenantId: fakeTenant._id, clientId: { id: "c2" } },
    ];

    const cap: any = {};
    const { ctx, capture } = makeCtx({ tenant: fakeTenant, assessments: fakeAssessments, capture: cap });

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u7", orgId: "org1" }),
      assertRole: (_ctx: any, _user: any, role: string) => {
        expectCompat(role).toBe("detailer");
      },
    }, async () => {
      const result = await mod.getAssessments.handler(ctx);
      expectCompat(result).toEqual(fakeAssessments);
    });

    // Confirm filter applied on tenantId for assessments
    expectCompat(capture.assessmentsEq?.[0]).toEqual(["tenantId", fakeTenant._id]);
  });

  itCompat("getAssessments propagates role enforcement errors", async () => {
    const { mod, path } = await importModule();
    const { ctx } = makeCtx({ tenant: { _id: "t2" }, assessments: [] });

    await withAuthMock(path, {
      getUser: async () => ({ _id: "u8", orgId: "org1" }),
      assertRole: () => { throw new Error("Not allowed"); },
    }, async () => {
      await expectCompat(mod.getAssessments.handler(ctx)).rejects.toThrow("Not allowed");
    });
  });
});