/**
 * Tests for convex auth functions.
 *
 * Framework: Compatible with Vitest or Jest.
 * - Uses global describe/it/expect.
 * - Uses vi/jest for mocks if available; otherwise falls back to a minimal stub.
 *
 * Covered scenarios:
 * - assertRole: success when role present; errors when missing; empty roles; malformed user object
 * - getUser:
 *    • unauthenticated (no identity) -> error and DB not touched
 *    • success path: queries users with index 'by_clerk_id' and eq('clerkId', subject)
 *    • not found -> error
 *    • DB error propagation from unique()
 *    • identity present but subject undefined -> eq receives undefined
 */
type AnyFn = (...args: any[]) => any;

// Detect runtime
const isVitest =
  typeof globalThis !== "undefined" &&
  (globalThis as any).vi &&
  typeof (globalThis as any).vi.fn === "function";
const isJest =
  typeof globalThis !== "undefined" &&
  (globalThis as any).jest &&
  typeof (globalThis as any).jest.fn === "function";

// Unified mock factory (vi.fn or jest.fn); fallback returns a passthrough stub
const mockFn: (impl?: AnyFn) => any =
  isVitest
    ? (globalThis as any).vi.fn
    : isJest
    ? (globalThis as any).jest.fn
    : ((impl?: AnyFn) =>
        function stub(this: any, ...args: any[]) {
          return impl?.apply(this, args);
        });

// Resolve auth module path across common locations in this repo
function resolveAuthModulePath(): string {
  const candidates = [
    // Monorepo-style path detected in this repo structure
    "../../SlickSolutions/slicksolutions/convex/auth",
    // Common project roots
    "../../convex/auth",
    "../../src/convex/auth",
    "../../auth",
  ];
  for (const p of candidates) {
    try {
      require.resolve(p);
      return p;
    } catch {
      /* try next */
    }
  }
  // Best-effort default
  return "../../convex/auth";
}

// Import module under test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authMod = require(resolveAuthModulePath());
const { assertRole, getUser } = authMod as {
  assertRole: (ctx: any, user: any, role: "admin" | "detailer" | "client") => void;
  getUser: (ctx: any) => Promise<any>;
};

type Instrumentation = {
  tables: string[];
  indexes: string[];
  eqCalls: Array<[string, any]>;
  uniqueCalls: number;
};

type Ctx = {
  instrument: Instrumentation;
  auth: { getUserIdentity: () => Promise<null | { subject: any }> };
  db: {
    query: (table: string) => {
      withIndex: (
        name: string,
        cb: (q: { eq: (field: string, val: any) => void }) => void
      ) => {
        unique: () => Promise<any | null>;
      };
    };
  };
};

// Factory for a Convex-like ctx with instrumentation
function makeCtxMock(options: {
  identity?: { subject?: any } | null;
  userFromDb?: any | null;
}): Ctx {
  const instrument: Instrumentation = {
    tables: [],
    indexes: [],
    eqCalls: [],
    uniqueCalls: 0,
  };

  const identity =
    options.identity === undefined ? { subject: "sub_default" } : options.identity;

  const eq = mockFn((field: string, val: any) => {
    instrument.eqCalls.push([field, val]);
  });

  const unique = mockFn(async () => {
    instrument.uniqueCalls += 1;
    if (Object.prototype.hasOwnProperty.call(options, "userFromDb")) {
      return options.userFromDb as any;
    }
    // default user
    return { _id: "user_1", clerkId: identity && (identity as any).subject, roles: ["client"] };
  });

  const withIndex = mockFn((name: string, cb: (q: { eq: (f: string, v: any) => void }) => void) => {
    instrument.indexes.push(name);
    cb({ eq });
    return { unique };
  });

  const query = mockFn((table: string) => {
    instrument.tables.push(table);
    return { withIndex };
  });

  return {
    instrument,
    auth: { getUserIdentity: async () => identity as any },
    db: { query },
  };
}

/* ===================== assertRole ===================== */
describe("assertRole", () => {
  it("does not throw when user has the required role (happy path)", () => {
    const user: any = { roles: ["client", "detailer"] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "detailer")).not.toThrow();
  });

  it("throws with a clear message when user lacks the role", () => {
    const user: any = { roles: ["client"] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "admin")).toThrowError(
      new Error("User does not have the required role: admin")
    );
  });

  it("throws when roles array is empty", () => {
    const user: any = { roles: [] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "client")).toThrow();
  });

  it("throws on malformed user object that lacks 'roles'", () => {
    const user: any = {};
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "client")).toThrow();
  });
});

/* ===================== getUser ===================== */
describe("getUser", () => {
  it("rejects when user is not authenticated and does not touch the DB", async () => {
    const ctx = makeCtxMock({ identity: null });
    await expect(getUser(ctx as any)).rejects.toThrowError("User is not authenticated");
    expect(ctx.instrument.tables.length).toBe(0);
    expect(ctx.instrument.indexes.length).toBe(0);
    expect(ctx.instrument.uniqueCalls).toBe(0);
  });

  it("queries 'users' with index 'by_clerk_id' and eq('clerkId', subject) then returns the user (happy path)", async () => {
    const ctx = makeCtxMock({
      identity: { subject: "sub_abc" },
      userFromDb: { _id: "user_42", clerkId: "sub_abc", roles: ["client"] },
    });

    const user = await getUser(ctx as any);

    expect(user).toBeTruthy();
    expect(user._id).toBe("user_42");

    // Validate instrumentation
    expect(ctx.instrument.tables).toEqual(["users"]);
    expect(ctx.instrument.indexes).toEqual(["by_clerk_id"]);
    expect(ctx.instrument.eqCalls).toEqual([["clerkId", "sub_abc"]]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });

  it("rejects when DB returns no user", async () => {
    const ctx = makeCtxMock({
      identity: { subject: "missing_user" },
      userFromDb: null,
    });

    await expect(getUser(ctx as any)).rejects.toThrowError("User not found");
    // DB was consulted
    expect(ctx.instrument.tables).toEqual(["users"]);
    expect(ctx.instrument.indexes).toEqual(["by_clerk_id"]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });

  it("propagates unexpected DB errors from unique()", async () => {
    const identity = { subject: "sub_err" };
    const ctx: Ctx = {
      instrument: { tables: [], indexes: [], eqCalls: [], uniqueCalls: 0 },
      auth: { getUserIdentity: async () => identity },
      db: {
        query: (table: string) => {
          (ctx.instrument.tables as string[]).push(table);
          return {
            withIndex: (name: string, cb: (q: { eq: (f: string, v: any) => void }) => void) => {
              (ctx.instrument.indexes as string[]).push(name);
              cb({ eq: (_f: string, _v: any) => ctx.instrument.eqCalls.push([_f, _v]) });
              return {
                unique: async () => {
                  ctx.instrument.uniqueCalls += 1;
                  throw new Error("db failure");
                },
              };
            },
          };
        },
      },
    };

    await expect(getUser(ctx as any)).rejects.toThrowError("db failure");
    expect(ctx.instrument.tables).toEqual(["users"]);
    expect(ctx.instrument.indexes).toEqual(["by_clerk_id"]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });

  it("handles identity without subject by passing undefined to eq", async () => {
    const ctx = makeCtxMock({
      identity: { subject: undefined },
      userFromDb: { _id: "user_99", clerkId: undefined, roles: ["client"] },
    });

    const user = await getUser(ctx as any);
    expect(user._id).toBe("user_99");
    expect(ctx.instrument.eqCalls).toEqual([["clerkId", undefined]]);
  });
});

/**
 * ------------------------------------------------------------------------
 * Additional coverage appended on 2025-09-09
 * Framework note:
 *   - Repository search attempts to detect Vitest/Jest.
 *   - This file remains compatible with either runner via runtime detection (vi/jest).
 * ------------------------------------------------------------------------
 */

describe("assertRole - additional coverage", () => {
  it("allows when user has 'admin' role among multiple roles", () => {
    const user: any = { roles: ["client", "admin"] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "admin")).not.toThrow();
  });

  it("throws when user is null", () => {
    const ctx: any = {};
    expect(() => assertRole(ctx, null as any, "client")).toThrow();
  });

  it("throws when roles is not an array", () => {
    const user: any = { roles: "client" };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "client")).toThrow();
  });

  it("throws when role exists with different casing (e.g., 'ADMIN' vs 'admin')", () => {
    const user: any = { roles: ["ADMIN"] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "admin")).toThrow();
  });

  it("does not throw if roles contain duplicates and required role is present", () => {
    const user: any = { roles: ["detailer", "detailer", "client"] };
    const ctx: any = {};
    expect(() => assertRole(ctx, user, "detailer")).not.toThrow();
  });
});

describe("getUser - additional coverage", () => {
  it("returns a user when DB result is not provided explicitly (default mock path)", async () => {
    const ctx = makeCtxMock({ identity: { subject: "sub_default_case" } });
    const user = await getUser(ctx as any);

    expect(user).toBeTruthy();
    expect(user.clerkId).toBe("sub_default_case");
    expect(ctx.instrument.eqCalls).toEqual([["clerkId", "sub_default_case"]]);
    expect(ctx.instrument.tables).toEqual(["users"]);
    expect(ctx.instrument.indexes).toEqual(["by_clerk_id"]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });

  it("rejects and does not touch DB if getUserIdentity throws", async () => {
    const ctx: Ctx = {
      instrument: { tables: [], indexes: [], eqCalls: [], uniqueCalls: 0 },
      auth: { getUserIdentity: async () => { throw new Error("identity provider failure"); } },
      db: {
        query: (_table: string) => ({
          withIndex: (_name: string, _cb: any) => ({
            unique: async () => {
              throw new Error("should not be called when auth fails");
            },
          }),
        }),
      },
    };

    await expect(getUser(ctx as any)).rejects.toThrowError("identity provider failure");
    expect(ctx.instrument.tables).toEqual([]);
    expect(ctx.instrument.indexes).toEqual([]);
    expect(ctx.instrument.uniqueCalls).toBe(0);
  });

  it("rejects when identity is undefined (unauthenticated)", async () => {
    const ctx: Ctx = {
      instrument: { tables: [], indexes: [], eqCalls: [], uniqueCalls: 0 },
      auth: { getUserIdentity: async () => undefined as any },
      db: {
        query: (_table: string) => ({
          withIndex: (_name: string, _cb: any) => ({
            unique: async () => null,
          }),
        }),
      },
    };

    await expect(getUser(ctx as any)).rejects.toThrowError("User is not authenticated");
    expect(ctx.instrument.tables).toEqual([]);
    expect(ctx.instrument.indexes).toEqual([]);
    expect(ctx.instrument.uniqueCalls).toBe(0);
  });

  it("passes through non-string subject values (number) unchanged to eq", async () => {
    const ctx = makeCtxMock({
      identity: { subject: 12345 as any },
      userFromDb: { _id: "user_num", clerkId: 12345, roles: ["client"] },
    });

    const user = await getUser(ctx as any);
    expect(user._id).toBe("user_num");
    expect(ctx.instrument.eqCalls).toEqual([["clerkId", 12345]]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });

  it("handles identity with null subject by passing null to eq", async () => {
    const ctx = makeCtxMock({
      identity: { subject: null as any },
      userFromDb: { _id: "user_null", clerkId: null, roles: ["client"] },
    });

    const user = await getUser(ctx as any);
    expect(user._id).toBe("user_null");
    expect(ctx.instrument.eqCalls).toEqual([["clerkId", null]]);
    expect(ctx.instrument.uniqueCalls).toBe(1);
  });
});