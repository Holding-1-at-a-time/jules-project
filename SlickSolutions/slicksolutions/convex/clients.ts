import { query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Gets a client by their ID.
 * @param id The ID of the client.
 * @returns The client object, or null if not found.
 */
export const get = query({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    return client;
  },
});

/**
 * Gets a client by their associated user ID.
 * @param userId The ID of the user.
 * @returns The client object, or null if not found.
 */
export const getByUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query('clients')
      .withIndex('by_user_id', (q) => q.eq('userId', args.userId))
      .unique();
    return client;
  },
});
