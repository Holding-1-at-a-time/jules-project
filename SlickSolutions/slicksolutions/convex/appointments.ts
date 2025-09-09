import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

export const create = mutation({
  args: {
    clientId: v.string(),
    serviceId: v.string(),
    appointmentTime: v.string(),
  },
  handler: async (ctx, { clientId, serviceId, appointmentTime }) => {
    const client = await ctx.db.get(clientId as Id<'clients'>);
    if (!client) {
      return { success: false, message: 'Client not found' };
    }
    const service = await ctx.db.get(serviceId as Id<'services'>);
    if (!service) {
      return { success: false, message: 'Service not found' };
    }
    await ctx.db.insert('appointments', {
      clientId: client._id,
      serviceId: service._id,
      appointmentTime,
    });
    return { success: true };
  },
});
