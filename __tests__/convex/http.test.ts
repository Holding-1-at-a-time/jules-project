/**
 * Tests for convex/http.ts webhook handler.
 * Framework note: Compatible with Jest or Vitest (uses globalThis.vi || globalThis.jest).
 *
 * Covered scenarios:
 * - Missing CLERK_WEBHOOK_SECRET throws.
 * - Invalid signature -> 400.
 * - user.created -> createOrUpdateUser mutation and 200.
 * - user.updated -> createOrUpdateUser mutation and 200.
 * - user.deleted -> deleteUser mutation and 200.
 * - Unhandled event type -> logs warning and 200.
 */

type AnyMocker = {
  fn: (...args: any[]) => any;
  mock: (mod: string, factory: () => any) => void;
  spyOn?: (...args: any[]) => any;
  resetAllMocks?: () => void;
  clearAllMocks?: () => void;
};

const mocker: AnyMocker = (globalThis as any).vi ?? (globalThis as any).jest;

const { describe, it, test, beforeEach, afterEach, expect } =
  (globalThis as any);

// Capture the handler registered via http.route(...)
let capturedHandler: ((ctx: any, request: Request) => Promise<Response>) | null = null;

// Mock convex/server to capture route registration and expose httpAction passthrough
mocker.mock('convex/server', () => {
  return {
    httpRouter: () => ({
      route: (opts: { path: string; method: string; handler: any }) => {
        capturedHandler = opts.handler;
      },
    }),
  };
});

// httpAction just returns the function unchanged in unit tests
mocker.mock('../../convex/_generated/server', () => ({
  httpAction:
    (fn: any) =>
    (ctx: any, request: Request) =>
      fn(ctx, request),
}));

// Provide internal.users action references
const createOrUpdateUserRef = { _type: 'mutationRef', path: 'users.createOrUpdateUser' };
const deleteUserRef = { _type: 'mutationRef', path: 'users.deleteUser' };

mocker.mock('../../convex/_generated/api', () => ({
  internal: {
    users: {
      createOrUpdateUser: createOrUpdateUserRef,
      deleteUser: deleteUserRef,
    },
  },
}));

// Mock svix Webhook.verify behavior
const verifyMock = mocker.fn();
mocker.mock('svix', () => {
  return {
    Webhook: class {
      constructor(_secret: string) {}
      verify(payload: string, headers: Record<string, string>) {
        return verifyMock(payload, headers);
      }
    },
  };
});

// Import module under test AFTER mocks
// Prefer resolving to convex/http (repo root). If path differs, adjust here.
let httpModule: any;
try {
  httpModule = require('../../convex/http').default;
} catch {
  try {
    // Fallback for alternate path (e.g., src/convex/http)
    httpModule = require('../../src/convex/http').default;
  } catch (e) {
    // As a last resort, try current directory (useful in PR previews where file paths vary)
    try {
      httpModule = require('./http').default;
    } catch {
      // Do not crash on import; tests that exercise handler use capturedHandler anyway.
    }
  }
}

const makeRequest = (body: any, headers: Record<string, string> = {}) =>
  new Request('https://example.test/clerk-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    } as any,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const baseSvixHeaders = {
  'svix-id': 'msg_123',
  'svix-timestamp': String(Math.floor(Date.now() / 1000)),
  'svix-signature': 'v1,abc',
};

const makeCtx = () => {
  return {
    runMutation: mocker.fn().mockResolvedValue(undefined),
  };
};

const resetEnv = (fn: () => Promise<void> | void) => {
  const prev = process.env.CLERK_WEBHOOK_SECRET;
  return async () => {
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test';
    try {
      await fn();
    } finally {
      process.env.CLERK_WEBHOOK_SECRET = prev;
    }
  };
};

beforeEach?.(() => {
  mocker.clearAllMocks?.();
  mocker.resetAllMocks?.();
  (globalThis as any).console = {
    ...console,
    log: mocker.fn(),
    error: mocker.fn(),
  };
  // Ensure handler was captured by importing module
});

afterEach?.(() => {
  // no-op, but kept for symmetry
});

describe?.('Clerk webhook httpAction handler', () => {
  test?.(
    'throws when CLERK_WEBHOOK_SECRET is not set',
    async () => {
      process.env.CLERK_WEBHOOK_SECRET = '';
      const ctx = makeCtx();
      verifyMock.mockReturnValueOnce({}); // should not be reached

      // Ensure module under test registered a handler
      expect(typeof capturedHandler).toBe('function');

      await expect(
        capturedHandler!(ctx, makeRequest({})),
      ).rejects.toThrow('CLERK_WEBHOOK_SECRET is not set');
      expect(ctx.runMutation).not.toHaveBeenCalled();
    },
    10000,
  );

  test?.(
    'returns 400 on invalid signature (verify throws)',
    resetEnv(async () => {
      const ctx = makeCtx();
      const payload = { type: 'user.created', data: { id: 'u_1' } };
      verifyMock.mockImplementationOnce(() => {
        throw new Error('bad sig');
      });

      const res = await capturedHandler!(ctx, makeRequest(payload, baseSvixHeaders));
      expect(res.status).toBe(400);
      expect(ctx.runMutation).not.toHaveBeenCalled();
      expect((console as any).error).toHaveBeenCalled(); // logs verification error
    }),
    10000,
  );

  test?.(
    'handles user.created: calls createOrUpdateUser and returns 200',
    resetEnv(async () => {
      const ctx = makeCtx();
      const event = {
        type: 'user.created',
        data: {
          id: 'user_123',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email_addresses: [{ email_address: 'ada@example.com' }],
        },
      };
      verifyMock.mockReturnValueOnce(event);

      const res = await capturedHandler!(ctx, makeRequest(event, baseSvixHeaders));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledTimes(1);
      expect(ctx.runMutation).toHaveBeenCalledWith(createOrUpdateUserRef, {
        clerkId: 'user_123',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
      });
    }),
    10000,
  );

  test?.(
    'handles user.updated: updates user and returns 200 (email optional)',
    resetEnv(async () => {
      const ctx = makeCtx();
      const event = {
        type: 'user.updated',
        data: {
          id: 'user_789',
          first_name: 'Grace',
          last_name: 'Hopper',
          email_addresses: [], // optional email
        },
      };
      verifyMock.mockReturnValueOnce(event);

      const res = await capturedHandler!(ctx, makeRequest(event, baseSvixHeaders));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(createOrUpdateUserRef, {
        clerkId: 'user_789',
        email: undefined,
        name: 'Grace Hopper',
      });
    }),
    10000,
  );

  test?.(
    'handles user.deleted: deletes user and returns 200',
    resetEnv(async () => {
      const ctx = makeCtx();
      const event = {
        type: 'user.deleted',
        data: {
          id: 'user_del_1',
        },
      };
      verifyMock.mockReturnValueOnce(event);

      const res = await capturedHandler!(ctx, makeRequest(event, baseSvixHeaders));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(deleteUserRef, {
        clerkId: 'user_del_1',
      });
    }),
    10000,
  );

  test?.(
    'logs unhandled event type and returns 200',
    resetEnv(async () => {
      const ctx = makeCtx();
      const event = {
        type: 'organization.created',
        data: { id: 'org_123' },
      };
      verifyMock.mockReturnValueOnce(event);

      const res = await capturedHandler!(ctx, makeRequest(event, baseSvixHeaders));
      expect(res.status).toBe(200);
      expect((console as any).log).toHaveBeenCalledWith(
        'Unhandled Clerk webhook event:',
        'organization.created',
      );
      expect(ctx.runMutation).not.toHaveBeenCalled();
    }),
    10000,
  );
});