import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

export const getByUserId = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('clients')
      .withIndex('by_user_id', (q) => q.eq('userId', userId))
      .unique();
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, email }) => {
    const doc = await ctx.db.get(id as Id<'clients'>);
    if (!doc) {
      return { success: false, message: 'Client not found' };
    }
    await ctx.db.patch(doc._id, { name, email });
    return { success: true };
  },
});
