import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

export const getUpcomingAppointments = internalQuery({
    args: {
        startTime: v.number(),
        endTime: v.number(),
    },
    handler: async (ctx, { startTime, endTime }) => {
        return await ctx.db
            .query('appointments')
            .filter((q) =>
                q.and(
                    q.gte(q.field('startTime'), startTime),
                    q.lt(q.field('startTime'), endTime),
                    q.eq(q.field('status'), 'scheduled')
                )
            )
            .collect();
    },
});

export const markReminderSent = internalMutation({
    args: {
        appointmentId: v.id('appointments'),
    },
    handler: async (ctx, { appointmentId }) => {
        await ctx.db.patch(appointmentId, { reminderSent: true });
    },
});

export const getAvailableSlots = query({
  args: {
    detailerId: v.id('detailers'),
    serviceId: v.id('services'),
    date: v.string(), // "YYYY-MM-DD"
  },
  handler: async (ctx, { detailerId, serviceId, date }) => {
    // 1. Get availability for the given day
    const { workingHours, isUnavailable } = await ctx.runQuery(internal.availability.getAvailability, {
        detailerId,
        date,
    });

    if (isUnavailable || workingHours.length === 0) {
        return []; // Day is unavailable or no working hours
    }

    if (workingHours.length === 0) {
        return []; // No availability for this day
    }

    // 2. Get service duration
    const service = await ctx.db.get(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    const serviceDuration = service.duration; // in minutes

    // 3. Get existing appointments for the day
    const startOfDay = new Date(date).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    const existingAppointments = await ctx.db
      .query('appointments')
      .withIndex('by_detailer_id_start_time', (q) =>
        q.eq('detailerId', detailerId).gte('startTime', startOfDay).lt('startTime', endOfDay)
      )
      .collect();

    // 4. Generate all possible slots and filter out booked ones
    const availableSlots: string[] = [];
    const slotInterval = 15; // check for a new slot every 15 minutes

    for (const hours of workingHours) {
        const start = new Date(`${date}T${hours.startTime}Z`);
        const end = new Date(`${date}T${hours.endTime}Z`);

        let currentSlot = start;
        while (currentSlot.getTime() + serviceDuration * 60 * 1000 <= end.getTime()) {
            const slotEnd = new Date(currentSlot.getTime() + serviceDuration * 60 * 1000);

            const isBooked = existingAppointments.some(appt =>
                (currentSlot.getTime() < appt.endTime && slotEnd.getTime() > appt.startTime)
            );

            if (!isBooked) {
                availableSlots.push(currentSlot.toUTCString().substring(17, 22));
            }

            currentSlot = new Date(currentSlot.getTime() + slotInterval * 60 * 1000);
        }
    }

    return availableSlots;
  },
});

export const bookAppointment = mutation({
  args: {
    detailerId: v.id('detailers'),
    clientId: v.id('clients'),
    serviceId: v.id('services'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    // First, check if this slot is still available.
    // This is a simplified check. A real implementation would need to be more robust
    // and handle potential race conditions.
    const existingAppointments = await ctx.db
      .query('appointments')
      .withIndex('by_detailer_id_start_time', (q) => q.eq('detailerId', args.detailerId))
      .filter((q) => q.lt(q.field('startTime'), args.endTime) && q.gt(q.field('endTime'), args.startTime))
      .collect();

    if (existingAppointments.length > 0) {
      throw new Error('This time slot is no longer available.');
    }

    // Create the new appointment
    const appointmentId = await ctx.db.insert('appointments', {
      ...args,
      status: 'scheduled',
    });

    return appointmentId;
  },
});
