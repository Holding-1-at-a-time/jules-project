import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Gets the chat history for a specific client.
 * @param clientId The ID of the client.
 * @returns A list of chat messages for the client.
 */
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

/**
 * Sends a new message and saves it to the chat history.
 * @param tenantId The ID of the tenant.
 * @param clientId The ID of the client.
 * @param message The content of the message.
 * @param from Who the message is from ('user' or 'ai').
 */
export const send = mutation({
  args: {
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    message: v.string(),
    from: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('chatHistory', {
      ...args,
      createdAt: Date.now(),
    });
  },
});
