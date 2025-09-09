import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Creates a new user.
 * @param clerkId The ID of the user in Clerk.
 * @param email The email of the user.
 * @param name The name of the user.
 * @returns The ID of the newly created user.
 */
export const create = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      roles: [],
    });
    return userId;
  },
});

/**
 * Gets a user by their Clerk ID.
 * @param clerkId The ID of the user in Clerk.
 * @returns The user object, or null if not found.
 */
export const get = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique();
    return user;
  },
});

/**
 * Updates an existing user.
 * @param id The ID of the user to update.
 * @param tenantId The new ID of the tenant for the user.
 * @param roles The new roles for the user.
 */
export const update = mutation({
  args: {
    id: v.id('users'),
    tenantId: v.optional(v.id('tenants')),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

/**
 * Gets the currently authenticated user.
 * @returns The user object, or null if not authenticated.
 */
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
