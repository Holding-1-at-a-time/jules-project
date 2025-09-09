import { z } from 'zod';

export const createAppointmentTool = {
  name: 'createAppointment',
  description: 'Create a new appointment for a client.',
  parameters: z.object({
    clientId: z.string(),
    serviceId: z.string(),
    appointmentTime: z.string().datetime(),
  }),
};

export const updateClientInfoTool = {
  name: 'updateClientInfo',
  description: 'Update a client\'s information.',
  parameters: z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  }),
};
