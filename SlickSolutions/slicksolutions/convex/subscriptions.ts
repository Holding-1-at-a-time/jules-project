import { mutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new subscription record for a user.
 * @param userId The ID of the user.
 * @param stripeSubscriptionId The ID of the subscription in Stripe.
 * @param stripeCustomerId The ID of the customer in Stripe.
 * @param stripePriceId The ID of the price (plan) in Stripe.
 * @param stripeCurrentPeriodEnd The end of the current billing period (Unix timestamp).
 */
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

/**
 * Updates an existing subscription record.
 * @param stripeSubscriptionId The ID of the subscription in Stripe.
 * @param stripePriceId The new ID of the price (plan) in Stripe.
 * @param stripeCurrentPeriodEnd The new end of the current billing period (Unix timestamp).
 */
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

/**
 * Deletes a subscription record.
 * @param stripeSubscriptionId The ID of the subscription in Stripe to delete.
 */
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
