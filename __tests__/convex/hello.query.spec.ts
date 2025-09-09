/**
 * Framework: We use the project's existing test runner (Jest or Vitest).
 * - If Jest: jest.mock and expect are available globally.
 * - If Vitest: vi.mock and expect are available; we alias to a common mock API.
 *
 * Strategy:
 * - Mock './_generated/server' to have `query` return the `handler` function directly.
 * - Import { get } from the module under test and call it like a plain async function.
 * - Validate happy path, misuse (unexpected args), and that `ctx` parameter is not required.
 */

let isVitest = false;
try {
  // Vitest provides a global vi
  // @ts-ignore
  isVitest = typeof vi !== "undefined";
} catch (_e) {
  isVitest = false;
}

// Unify mock API between Jest and Vitest
const mocker = isVitest
  ? {
      mock: (m: string, f: () => any) => {
        // @ts-ignore
        return vi.mock(m, f);
      },
    }
  : {
      mock: (m: string, f: () => any) => {
        // @ts-ignore
        return jest.mock(m, f);
      },
    };

// Arrange: mock Convex generated server to make `query` return the handler itself
mocker.mock("./_generated/server", () => {
  return {
    // When the app calls query({ args, handler }), we return handler for direct invocation in tests
    query: (def) => {
      if (!def || typeof def.handler !== "function") {
        throw new Error("query was called without a valid handler");
      }
      // Attach the original definition for potential meta checks
      Object.defineProperty(def.handler, "__def", { value: def, enumerable: false });
      return def.handler;
    },
  };
});

// Now import the module under test. Path is the same as provided snippet.
import { get } from "./hello.test";

describe("convex/hello.get query", () => {
  it("returns the expected greeting (happy path)", async () => {
    const result = await get({}); // we pass {} as a stand-in ctx
    expect(result).toBe("Hello from Convex!");
  });

  it("does not rely on ctx and works with undefined ctx", async () => {
    // @ts-ignore - intentionally passing undefined to assert handler robustness
    const result = await get(undefined);
    expect(result).toBe("Hello from Convex!");
  });

  it("exposes a definition with empty args schema", () => {
    // Access internal definition attached by our mock
    const def: any = (get as any).__def;
    expect(def).toBeDefined();
    expect(def.args).toEqual({});
    expect(typeof def.handler).toBe("function");
  });

  it("is a pure function for the given implementation (idempotent, no side effects observed)", async () => {
    const ctx = {}; // minimal ctx double
    const r1 = await get(ctx);
    const r2 = await get(ctx);
    expect(r1).toBe("Hello from Convex!");
    expect(r2).toBe("Hello from Convex!");
  });

  it("rejects improper construction if query is called with invalid definition (guard in mock)", async () => {
    // This test validates our mocking guard, ensuring meaningful failure on misconfiguration.
    // Re-import the mock factory to call directly.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { query } = require("./_generated/server");
    expect(() => query(undefined)).toThrow(/valid handler/);
    expect(() => query({} as any)).toThrow(/valid handler/);
    expect(() => query({ handler: null } as any)).toThrow(/valid handler/);
  });
});