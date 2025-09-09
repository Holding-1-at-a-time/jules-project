import { Auth } from 'convex/server';
import { query } from './_generated/server';

/**
 * Get the current user from the request context.
 * @param {any} ctx - The request context.
 * @returns {Promise<any>} The user object.
 * @throws {Error} If the user is not authenticated.
 */
export const getUser = async (ctx: { auth: Auth }) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity;
};

/**
 * Get the current user and their tenant from the request context.
 * This is a convenience function that builds on top of getUser.
 * @param {any} ctx - The request context.
 * @returns {Promise<any>} The user and tenant objects.
 * @throws {Error} If the user is not authenticated or does not have a tenant.
 */
export const getUserAndTenant = query(async (ctx) => {
  const identity = await getUser(ctx);
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.tenantId) {
    throw new Error('User does not have a tenant');
  }

  const tenant = await ctx.db.get(user.tenantId);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return { user, tenant };
});
