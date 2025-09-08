import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

const crons = cronJobs();

crons.daily(
  "send-daily-reminders",
  { hourUTC: 12, minuteUTC: 0 }, // Run every day at 12:00 UTC
  internal.jobs.sendAppointmentReminders
);

export const sendAppointmentReminders = internalAction({
    handler: async (ctx) => {
        const now = Date.now();
        const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

        const upcomingAppointments = await ctx.runQuery(internal.appointments.getUpcomingAppointments, {
            startTime: now,
            endTime: twentyFourHoursFromNow,
        });

        for (const appointment of upcomingAppointments) {
            if (!appointment.reminderSent) {
                console.log(`Sending reminder for appointment ${appointment._id}`);
                // Here you would integrate with an email or SMS service.
                // For now, we just log to the console and update the appointment.
                await ctx.runMutation(internal.appointments.markReminderSent, {
                    appointmentId: appointment._id,
                });
            }
        }
    },
});


export default crons;
