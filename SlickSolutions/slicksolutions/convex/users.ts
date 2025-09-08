import { query } from './_generated/server';
import { getUserAndTenant } from './utils';

/**
 * Get the current user and their tenant.
 * This is a simple query that uses the getUserAndTenant helper.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getUserAndTenant(ctx, {});
  },
});
