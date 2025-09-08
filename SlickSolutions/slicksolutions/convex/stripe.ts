import { v } from 'convex/values';
import { internalMutation, action, httpAction } from './_generated/server';
import { internal } from './_generated/api';
import Stripe from 'stripe';

// TODO: Add your Stripe secret key here
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export const storeStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId });
  },
});

// Create a checkout session
export const createStripeCheckoutSession = action({
  args: { planId: v.string(), tenantId: v.id('tenants') },
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: args.planId, quantity: 1 }],
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
    status: v.string(),
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
      subscriptionStatus: 'cancelled',
    });
  },
});

export const handleFailedPayment = internalMutation({
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
      subscriptionStatus: 'past_due',
    });
  },
});

// Stripe webhook handler
export const stripeWebhook = httpAction(async (ctx, request) => {
  const sig = request.headers.get('stripe-signature') as string;
  const body = await request.text();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(err);
    return new Response('Webhook Error', { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const subscription = event.data.object as Stripe.Subscription;

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const completedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items'],
      });
      const lineItems = completedSession.line_items;
      if (!lineItems) {
        console.error('No line items found in session');
        break;
      }
      const plan = lineItems.data[0].price!.id;
      await ctx.runMutation(internal.stripe.fulfillSubscription, {
        userId: session.metadata!.userId,
        subscriptionId: session.subscription as string,
        plan: plan,
      });
      break;
    case 'customer.subscription.updated':
      await ctx.runMutation(internal.stripe.updateSubscription, {
        subscriptionId: subscription.id,
        plan: subscription.items.data[0].price.id,
        status: subscription.status,
      });
      break;
    case 'customer.subscription.deleted':
      await ctx.runMutation(internal.stripe.cancelSubscription, {
        subscriptionId: subscription.id,
      });
      break;
    case 'invoice.payment_failed':
      await ctx.runMutation(internal.stripe.handleFailedPayment, {
        subscriptionId: subscription.id,
      });
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(null, { status: 200 });
});
