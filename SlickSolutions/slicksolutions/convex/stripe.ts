import { v } from 'convex/values';
import { internalMutation, action, httpAction } from './_generated/server';
import { internal } from './_generated/api';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable not set!');
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable not set!');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

// Mapping of plan names to Stripe Price IDs
// TODO: Replace with your actual Price IDs
const planToPriceId = {
  Launch: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jJ',
  Grow: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jK',
  Scale: 'price_1P5qKkRKRiyf2Y7s4YJ4g3jL',
};

const priceIdToPlan = Object.fromEntries(
  Object.entries(planToPriceId).map(([plan, priceId]) => [priceId, plan])
);

export const storeStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId });
  },
});

// Create a checkout session
export const createStripeCheckoutSession = action({
  args: { plan: v.union(v.literal('Launch'), v.literal('Grow'), v.literal('Scale')), tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();

    if (!user) {
      throw new Error('You must be logged in to subscribe.');
    }

    const dbUser = await ctx.runQuery(internal.users.getUser, { clerkId: user.subject });

    if (!dbUser) {
      throw new Error('User not found.');
    }

    let stripeCustomerId = dbUser.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
      });
      stripeCustomerId = customer.id;
      await ctx.runMutation(internal.stripe.storeStripeCustomerId, {
        userId: dbUser._id,
        stripeCustomerId,
      });
    }

    const priceId = planToPriceId[args.plan];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payment=cancelled`,
      metadata: {
        userId: dbUser._id,
        tenantId: args.tenantId,
      },
    });

    return session.url;
  },
});

export const createStripeCustomerPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();

    if (!user) {
      throw new Error('You must be logged in to manage your subscription.');
    }

    const dbUser = await ctx.runQuery(internal.users.getUser, { clerkId: user.subject });

    if (!dbUser || !dbUser.stripeCustomerId) {
      throw new Error('User not found or does not have a Stripe customer ID.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
    });

    return session.url;
  },
});

export const getBillingHistory = action({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const invoices = await stripe.invoices.list({
      customer: args.stripeCustomerId,
    });
    return invoices.data;
  },
});

export const fulfillSubscription = internalMutation({
  args: {
    userId: v.id('users'),
    subscriptionId: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, { userId, subscriptionId, plan }) => {
    await ctx.db.patch(userId, {
      subscriptionId,
      plan,
      subscriptionStatus: 'active',
    });
  },
});

export const updateSubscription = internalMutation({
  args: {
    subscriptionId: v.string(),
    plan: v.string(),
    status: v.any(), // Assuming the status can be any of the defined literals
  },
  handler: async (ctx, { subscriptionId, plan, status }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_subscription_id', (q) => q.eq('subscriptionId', subscriptionId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      plan,
      subscriptionStatus: status,
    });
  },
});

export const cancelSubscription = internalMutation({
  args: { subscriptionId: v.string() },
  handler: async (ctx, { subscriptionId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_subscription_id', (q) => q.eq('subscriptionId', subscriptionId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      subscriptionId: undefined,
      plan: undefined,
      subscriptionStatus: 'canceled',
    });
  },
});

export const handleFailedPayment = internalMutation({
  args: { subscriptionId: v.string(), status: v.any() },
  handler: async (ctx, { subscriptionId, status }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_subscription_id', (q) => q.eq('subscriptionId', subscriptionId))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      subscriptionStatus: status,
    });
  },
});

// Stripe webhook handler
export const stripeWebhook = httpAction(async (ctx, request) => {
  const sig = request.headers.get('stripe-signature') as string;
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response('Webhook Error', { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const subscription = event.data.object as Stripe.Subscription;

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('checkout.session.completed', session);
      const completedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items'],
      });
      const lineItems = completedSession.line_items;
      if (!lineItems) {
        console.error('No line items found in session', { sessionId: session.id });
        break;
      }
      const priceId = lineItems.data[0].price!.id;
      const plan = priceIdToPlan[priceId];
      if (!plan) {
        console.error(`Plan not found for price ID: ${priceId}`);
        break;
      }
      await ctx.runMutation(internal.stripe.fulfillSubscription, {
        userId: session.metadata!.userId,
        subscriptionId: session.subscription as string,
        plan: plan,
      });
      break;
    case 'customer.subscription.updated':
      console.log('customer.subscription.updated', subscription);
      const updatedPriceId = subscription.items.data[0].price.id;
      const updatedPlan = priceIdToPlan[updatedPriceId];
      if (!updatedPlan) {
        console.error(`Plan not found for price ID: ${updatedPriceId}`);
        break;
      }
      await ctx.runMutation(internal.stripe.updateSubscription, {
        subscriptionId: subscription.id,
        plan: updatedPlan,
        status: subscription.status,
      });
      break;
    case 'customer.subscription.deleted':
      console.log('customer.subscription.deleted', subscription);
      await ctx.runMutation(internal.stripe.cancelSubscription, {
        subscriptionId: subscription.id,
      });
      break;
    case 'invoice.payment_failed':
      console.log('invoice.payment_failed', event.data.object);
      await ctx.runMutation(internal.stripe.handleFailedPayment, {
        subscriptionId: subscription.id,
        status: subscription.status,
      });
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(null, { status: 200 });
});
