import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Get chat history for a client
export const getForClient = query({
  args: { clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const chatHistory = await ctx.db
      .query('chatHistory')
      .withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
      .collect();
    return chatHistory;
  },
});

// Send a new message
export const send = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    message: v.string(),
    from: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('chatHistory', args);
  },
});
