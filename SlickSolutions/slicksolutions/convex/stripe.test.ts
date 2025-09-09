/**
 * Comprehensive unit tests for convex/stripe.ts (actions, internal mutations, webhook).
 *
 * Testing library/framework note:
 * - Repository has no configured test runner. These tests are written for Vitest (preferred),
 *   but are largely compatible with Jest (replace vi with jest where needed).
 * - A minimal vitest.config.ts is included in this PR to make local runs easy without new deps.
 *
 * External dependencies are mocked (Stripe SDK). Convex ctx is stubbed per test.
 * Env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_URL) are set/reset per test.
 */

type AnyFn = (...args: any[]) => any;

// Runtime adapter for Vitest/Jest
const runtime = (() => {
  try {
    // @ts-ignore
    const v = require('vitest');
    return { ...v, vi: v.vi, isVitest: true };
  } catch {
    // @ts-ignore
    return {
      describe, it, expect, beforeEach, afterEach,
      vi: (global as any).jest || {},
      isVitest: false,
    };
  }
})();

const { describe, it, expect, beforeEach, afterEach, vi } = runtime as any;

const ORIGINAL_ENV = { ...process.env };

function resetAllMocks() {
  if ((vi as any).resetAllMocks) (vi as any).resetAllMocks();
  if ((vi as any).restoreAllMocks) (vi as any).restoreAllMocks();
  // @ts-ignore
  if ((global as any).jest?.resetAllMocks) (global as any).jest.resetAllMocks();
  // @ts-ignore
  if ((global as any).jest?.restoreAllMocks) (global as any).jest.restoreAllMocks();
}

async function resetModules() {
  // Prefer Vitest module reset if available; otherwise clear require cache when present.
  if ((vi as any).resetModules) {
    (vi as any).resetModules();
    return;
  }
  try {
    // @ts-ignore
    const mod = require;
    if (mod && mod.cache) {
      for (const k of Object.keys(mod.cache)) delete mod.cache[k];
    }
  } catch {
    // ignore
  }
}

function mockStripe() {
  const customersCreate = vi.fn().mockResolvedValue({ id: 'cus_123' });
  const checkoutSessionsCreate = vi.fn().mockResolvedValue({ id: 'cs_123', url: 'https://stripe.test/checkout/cs_123' });
  const checkoutSessionsRetrieve = vi.fn().mockResolvedValue({
    id: 'cs_123',
    line_items: { data: [{ price: { id: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jJ' } }] }
  });
  const portalSessionsCreate = vi.fn().mockResolvedValue({ id: 'bps_123', url: 'https://stripe.test/portal/bps_123' });
  const invoicesList = vi.fn().mockResolvedValue({ data: [{ id: 'in_1', amount_due: 1000 }, { id: 'in_2', amount_due: 0 }] });

  const constructEventOk = vi.fn().mockReturnValue({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_123', subscription: 'sub_123', metadata: { userId: 'u1' } } }
  });

  const stripeMock: any = function Stripe(_: string, __: any) { return stripeMock; };
  stripeMock.customers = { create: customersCreate };
  stripeMock.checkout = { sessions: { create: checkoutSessionsCreate, retrieve: checkoutSessionsRetrieve } };
  stripeMock.billingPortal = { sessions: { create: portalSessionsCreate } };
  stripeMock.invoices = { list: invoicesList };
  stripeMock.webhooks = { constructEvent: constructEventOk };

  return {
    stripeMock,
    fns: {
      customersCreate,
      checkoutSessionsCreate,
      checkoutSessionsRetrieve,
      portalSessionsCreate,
      invoicesList,
      constructEventOk
    }
  };
}

function buildCtx(overrides: Partial<any> = {}) {
  const db = {
    patch: vi.fn(),
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) })
    })
  };
  const auth = { getUserIdentity: vi.fn().mockResolvedValue(null) };
  const runQuery = vi.fn();
  const runMutation = vi.fn();
  return { db, auth, runQuery, runMutation, ...overrides };
}

describe('convex/stripe.ts actions, mutations, webhook', () => {
  beforeEach(() => {
    resetAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc',
      NEXT_PUBLIC_URL: 'http://localhost:3000',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws on missing STRIPE_SECRET_KEY at module load', async () => {
    process.env.STRIPE_SECRET_KEY = '';
    await resetModules();
    const { stripeMock } = mockStripe();
    // Dynamic mock before dynamic import
    if ((vi as any).doMock) {
      (vi as any).doMock('stripe', () => ({ default: stripeMock }));
    } else if ((vi as any).mock) {
      (vi as any).mock('stripe', () => ({ default: stripeMock }));
    }
    await expect(import('./stripe')).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });

  it('throws on missing STRIPE_WEBHOOK_SECRET at module load', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = '';
    await resetModules();
    const { stripeMock } = mockStripe();
    if ((vi as any).doMock) {
      (vi as any).doMock('stripe', () => ({ default: stripeMock }));
    } else if ((vi as any).mock) {
      (vi as any).mock('stripe', () => ({ default: stripeMock }));
    }
    await expect(import('./stripe')).rejects.toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  describe('createStripeCheckoutSession', () => {
    it('errors when user is not logged in', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');
      const ctx = buildCtx({ auth: { getUserIdentity: vi.fn().mockResolvedValue(null) } });

      await expect(
        mod.createStripeCheckoutSession.handler(ctx, { plan: 'Launch', tenantId: 't1' })
      ).rejects.toThrow(/logged in/i);
    });

    it('errors when dbUser not found', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');
      const ctx = buildCtx({
        auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_1', email: 'a@b.com', name: 'A' }) },
        runQuery: vi.fn().mockResolvedValue(null)
      });

      await expect(
        mod.createStripeCheckoutSession.handler(ctx, { plan: 'Launch', tenantId: 't1' })
      ).rejects.toThrow(/User not found/);
    });

    it('creates new stripe customer if missing and returns checkout URL', async () => {
      const { stripeMock, fns } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const dbUser = { _id: 'u1', stripeCustomerId: undefined };
      const ctx = buildCtx({
        auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_1', email: 'a@b.com', name: 'Alice' }) },
        runQuery: vi.fn().mockResolvedValue(dbUser),
        runMutation: vi.fn().mockResolvedValue(undefined)
      });

      const url = await mod.createStripeCheckoutSession.handler(ctx, { plan: 'Launch', tenantId: 't1' });

      expect(fns.customersCreate).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Alice' });
      expect(ctx.runMutation).toHaveBeenCalled();
      expect(fns.checkoutSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_123',
        line_items: [{ price: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jJ', quantity: 1 }]
      }));
      expect(url).toMatch(/^https:\/\/stripe\.test\/checkout/);
    });

    it('reuses existing stripe customer and returns checkout URL', async () => {
      const { stripeMock, fns } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const dbUser = { _id: 'u2', stripeCustomerId: 'cus_existing' };
      const ctx = buildCtx({
        auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_2', email: 'c@d.com', name: 'Bob' }) },
        runQuery: vi.fn().mockResolvedValue(dbUser),
      });

      const url = await mod.createStripeCheckoutSession.handler(ctx, { plan: 'Scale', tenantId: 't2' });

      expect(fns.customersCreate).not.toHaveBeenCalled();
      expect(fns.checkoutSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_existing'
      }));
      expect(url).toMatch(/^https:\/\/stripe\.test\/checkout/);
    });
  });

  describe('createStripeCustomerPortalSession', () => {
    it('requires login', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');
      const ctx = buildCtx({ auth: { getUserIdentity: vi.fn().mockResolvedValue(null) } });

      await expect(
        mod.createStripeCustomerPortalSession.handler(ctx, {})
      ).rejects.toThrow(/logged in/i);
    });

    it('errors when user missing stripeCustomerId', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({
        auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_3' }) },
        runQuery: vi.fn().mockResolvedValue({ _id: 'u3', stripeCustomerId: undefined })
      });

      await expect(
        mod.createStripeCustomerPortalSession.handler(ctx, {})
      ).rejects.toThrow(/does not have a Stripe customer ID/);
    });

    it('returns portal session url', async () => {
      const { stripeMock, fns } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({
        auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_4' }) },
        runQuery: vi.fn().mockResolvedValue({ _id: 'u4', stripeCustomerId: 'cus_portal' })
      });

      const url = await mod.createStripeCustomerPortalSession.handler(ctx, {});

      expect(fns.portalSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_portal' }));
      expect(url).toMatch(/\/portal\//);
    });
  });

  describe('getBillingHistory', () => {
    it('lists invoices for customer', async () => {
      const { stripeMock, fns } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx();
      const data = await mod.getBillingHistory.handler(ctx, { stripeCustomerId: 'cus_hist' });

      expect(fns.invoicesList).toHaveBeenCalledWith({ customer: 'cus_hist' });
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty('id');
    });
  });

  describe('internal mutations', () => {
    it('storeStripeCustomerId patches user', async () => {
      await resetModules();
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx();
      await mod.storeStripeCustomerId.handler(ctx, { userId: 'uX', stripeCustomerId: 'cus_X' });

      expect(ctx.db.patch).toHaveBeenCalledWith('uX', { stripeCustomerId: 'cus_X' });
    });

    it('fulfillSubscription sets active, plan, subscriptionId', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx();
      await mod.fulfillSubscription.handler(ctx, { userId: 'u1', subscriptionId: 'sub_1', plan: 'Grow' });

      expect(ctx.db.patch).toHaveBeenCalledWith('u1', expect.objectContaining({
        subscriptionId: 'sub_1',
        plan: 'Grow',
        subscriptionStatus: 'active'
      }));
    });

    it('updateSubscription patches user found by subscription id; throws if not found', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      // user not found -> throw
      const ctx1 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) })
          })
        }
      });
      await expect(
        mod.updateSubscription.handler(ctx1, { subscriptionId: 'sub_nf', plan: 'Launch', status: 'active' })
      ).rejects.toThrow(/User not found/);

      // user found -> patches
      const user = { _id: 'uFound' };
      const ctx2 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(user) })
          })
        }
      });
      await mod.updateSubscription.handler(ctx2, { subscriptionId: 'sub_yes', plan: 'Scale', status: 'trialing' });

      expect(ctx2.db.patch).toHaveBeenCalledWith('uFound', { plan: 'Scale', subscriptionStatus: 'trialing' });
    });

    it('cancelSubscription clears subscription fields; throws if user not found', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx1 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) })
          })
        }
      });
      await expect(
        mod.cancelSubscription.handler(ctx1, { subscriptionId: 'sub_none' })
      ).rejects.toThrow(/User not found/);

      const user = { _id: 'u5' };
      const ctx2 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(user) })
          })
        }
      });
      await mod.cancelSubscription.handler(ctx2, { subscriptionId: 'sub_cancel' });

      expect(ctx2.db.patch).toHaveBeenCalledWith('u5', {
        subscriptionId: undefined,
        plan: undefined,
        subscriptionStatus: 'canceled'
      });
    });

    it('handleFailedPayment updates subscriptionStatus; throws if user not found', async () => {
      const { stripeMock } = mockStripe();
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx1 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) })
          })
        }
      });
      await expect(
        mod.handleFailedPayment.handler(ctx1, { subscriptionId: 'sub_nf', status: 'past_due' })
      ).rejects.toThrow(/User not found/);

      const user = { _id: 'u6' };
      const ctx2 = buildCtx({
        db: {
          patch: vi.fn(),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(user) })
          })
        }
      });
      await mod.handleFailedPayment.handler(ctx2, { subscriptionId: 'sub_fail', status: 'unpaid' });

      expect(ctx2.db.patch).toHaveBeenCalledWith('u6', { subscriptionStatus: 'unpaid' });
    });
  });

  describe('stripeWebhook', () => {
    const makeRequest = (body: string, signature = 'sig_valid') => {
      return new Request('https://example.com/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signature },
        body
      });
    };

    it('returns 400 when signature invalid (constructEvent throws)', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn(() => { throw new Error('bad sig'); });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx();
      const res = await mod.stripeWebhook(ctx, makeRequest('{}', 'sig_bad'));
      expect(res.status).toBe(400);
    });

    it('handles checkout.session.completed, fulfills subscription, maps plan from price id', async () => {
      const { stripeMock, fns } = mockStripe();
      fns.checkoutSessionsRetrieve.mockResolvedValueOnce({
        id: 'cs_123',
        line_items: { data: [{ price: { id: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jJ' } }] }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}', 'sig_ok'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
        userId: 'u1',
        subscriptionId: 'sub_123',
        plan: 'Launch'
      });
    });

    it('logs and skips when checkout.session.completed has no line items', async () => {
      const { stripeMock, fns } = mockStripe();
      fns.checkoutSessionsRetrieve.mockResolvedValueOnce({ id: 'cs_123', line_items: null });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    });

    it('logs and skips when price id not mapped to plan', async () => {
      const { stripeMock, fns } = mockStripe();
      fns.checkoutSessionsRetrieve.mockResolvedValueOnce({
        id: 'cs_123',
        line_items: { data: [{ price: { id: 'price_NOT_MAPPED' } }] }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');
      const ctx = buildCtx({ runMutation: vi.fn() });

      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    });

    it('handles customer.subscription.updated and maps updated plan', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn().mockReturnValue({
        id: 'evt_2',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_789', status: 'active', items: { data: [{ price: { id: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jK' } }] } } }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
        subscriptionId: 'sub_789',
        plan: 'Grow',
        status: 'active'
      });
    });

    it('skips update when updated price id not mapped', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn().mockReturnValue({
        id: 'evt_3',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_789', status: 'active', items: { data: [{ price: { id: 'price_UNKNOWN' } }] } } }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    });

    it('handles customer.subscription.deleted', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn().mockReturnValue({
        id: 'evt_4',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_del' } }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), { subscriptionId: 'sub_del' });
    });

    it('handles invoice.payment_failed', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn().mockReturnValue({
        id: 'evt_5',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_fail', status: 'past_due' } }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
        subscriptionId: 'sub_fail',
        status: 'past_due'
      });
    });

    it('handles default (unhandled) events gracefully', async () => {
      const { stripeMock } = mockStripe();
      (stripeMock.webhooks.constructEvent as AnyFn) = vi.fn().mockReturnValue({
        id: 'evt_6',
        type: 'payout.paid',
        data: { object: {} }
      });
      (vi as any).doMock?.('stripe', () => ({ default: stripeMock }));
      const mod: any = await import('./stripe');

      const ctx = buildCtx({ runMutation: vi.fn() });
      const res = await mod.stripeWebhook(ctx, makeRequest('{}'));
      expect(res.status).toBe(200);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    });
  });
});