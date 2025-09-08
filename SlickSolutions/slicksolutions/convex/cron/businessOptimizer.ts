import { cronJobs } from 'convex/server';
import { api } from '../_generated/api';

const crons = cronJobs();

crons.weekly(
  'generate business recommendations',
  { dayOfWeek: 'monday', hourUTC: 8, minuteUTC: 0 },
  async (ctx) => {
    const tenants = await ctx.runQuery(api.tenants.getAll);
    for (const tenant of tenants) {
      await ctx.runAction(api.ai.businessOptimizer.generateRecommendation, {
        tenantId: tenant._id,
      });
    }
  }
);

export default crons;
