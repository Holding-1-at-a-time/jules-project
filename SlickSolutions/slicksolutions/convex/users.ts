import { internalQuery, query } from './_generated/server';
import { v } from 'convex/values';

// Get the current user
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .unique();
  },
});

export const getSubscriptionStatus = query({
  args: { userId: v.id('users') },
  async handler(ctx, args) {
    const user = await ctx.db.get(args.userId);
    return user?.subscriptionStatus;
  },
});

export const getStripeCustomerId = query({
  args: { userId: v.id('users') },
  async handler(ctx, args) {
    const user = await ctx.db.get(args.userId);
    return user?.stripeCustomerId;
  },
});

export const getUser = internalQuery({
  args: { clerkId: v.string() },
  async handler(ctx, args) {
    return await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
  },
});
