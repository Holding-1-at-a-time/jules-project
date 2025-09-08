import { mutation } from './_generated/server';
import { v } from 'convex/values';

// Create a new subscription
export const create = mutation({
  args: {
    userId: v.id('users'),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    stripePriceId: v.string(),
    stripeCurrentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('subscriptions', args);
  },
});

// Update a subscription
export const update = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    stripeCurrentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_subscription_id', (q) =>
        q.eq('stripeSubscriptionId', args.stripeSubscriptionId)
      )
      .unique();

    if (sub) {
      await ctx.db.patch(sub._id, {
        stripePriceId: args.stripePriceId,
        stripeCurrentPeriodEnd: args.stripeCurrentPeriodEnd,
      });
    }
  },
});

// Delete a subscription
export const del = mutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_subscription_id', (q) =>
        q.eq('stripeSubscriptionId', args.stripeSubscriptionId)
      )
      .unique();

    if (sub) {
      await ctx.db.delete(sub._id);
    }
  },
});
