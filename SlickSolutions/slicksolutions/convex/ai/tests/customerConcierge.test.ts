import { test, expect, vi } from 'vitest';
import { chat } from '../customerConcierge';
import { api } from '../_generated/api';

vi.mock('../_generated/server', () => ({
  action: vi.fn((config) => config),
}));

vi.mock('../_generated/api', () => ({
  api: {
    users: {
      me: vi.fn(),
    },
    clients: {
      getByUserId: vi.fn(),
    },
    assessments: {
      getForClient: vi.fn(),
    },
    chatHistory: {
      add: vi.fn(),
    },
    appointments: {
      create: vi.fn(),
    },
  },
}));

vi.mock('ai', () => {
  const Ollama = vi.fn();
  Ollama.prototype.chat = vi.fn();
  return {
    Ollama,
    StreamingTextResponse: vi.fn().mockImplementation((stream) => ({
      body: stream,
    })),
  };
});

test('should return a streaming text response', async () => {
  const { Ollama } = await import('ai');
  const ollama = new Ollama();
  ollama.chat.mockResolvedValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ delta: 'Hello' });
        controller.enqueue({ delta: ' World' });
        controller.close();
      },
    }),
    messages: [],
  });

  const ctx = {
    auth: {
      getUserIdentity: vi.fn(() => ({ subject: 'user1' })),
    },
    runQuery: vi.fn((query, args) => {
      if (query === api.users.me) {
        return { _id: 'user1', name: 'Test User' };
      }
      if (query === api.clients.getByUserId) {
        return { _id: 'client1', tenantId: 'tenant1' };
      }
      if (query === api.assessments.getForClient) {
        return [];
      }
    }),
    runMutation: vi.fn(),
  };
  const args = {
    message: 'Hello',
  };

  const response = await chat.handler(ctx, args);

  expect(response).toHaveProperty('body');
});

test('should call createAppointment tool and return a streaming text response', async () => {
  const { Ollama, StreamingTextResponse } = await import('ai');
  const ollama = new Ollama();
  ollama.chat
    .mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'tool_call', toolName: 'createAppointment', args: { clientId: 'client1', serviceId: 'service1', appointmentTime: '2025-10-26T10:00:00Z' } });
          controller.close();
        },
      }),
      messages: [],
    })
    .mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ delta: 'Appointment created' });
          controller.close();
        },
      }),
      messages: [],
    });

  const ctx = {
    auth: {
      getUserIdentity: vi.fn(() => ({ subject: 'user1' })),
    },
    runQuery: vi.fn((query, args) => {
      if (query === api.users.me) {
        return { _id: 'user1', name: 'Test User' };
      }
      if (query === api.clients.getByUserId) {
        return { _id: 'client1', tenantId: 'tenant1' };
      }
      if (query === api.assessments.getForClient) {
        return [];
      }
    }),
    runMutation: vi.fn(),
  };
  const args = {
    message: 'I want to create an appointment',
  };

  const response = await chat.handler(ctx, args);

  expect(ctx.runMutation).toHaveBeenCalledWith(api.appointments.create, {
    clientId: 'client1',
    serviceId: 'service1',
    appointmentTime: '2025-10-26T10:00:00Z',
  });
  expect(response).toHaveProperty('body');
});

test('should call updateClientInfo tool and return a streaming text response', async () => {
  const { Ollama } = await import('ai');
  const ollama = new Ollama();
  ollama.chat
    .mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'tool_call', toolName: 'updateClientInfo', args: { id: 'client1', name: 'New Name' } });
          controller.close();
        },
      }),
      messages: [],
    })
    .mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ delta: 'Client info updated' });
          controller.close();
        },
      }),
      messages: [],
    });

  const ctx = {
    auth: {
      getUserIdentity: vi.fn(() => ({ subject: 'user1' })),
    },
    runQuery: vi.fn((query, args) => {
      if (query === api.users.me) {
        return { _id: 'user1', name: 'Test User' };
      }
      if (query === api.clients.getByUserId) {
        return { _id: 'client1', tenantId: 'tenant1' };
      }
      if (query === api.assessments.getForClient) {
        return [];
      }
    }),
    runMutation: vi.fn(),
  };
  const args = {
    message: 'I want to update my name',
  };

  const response = await chat.handler(ctx, args);

  expect(ctx.runMutation).toHaveBeenCalledWith(api.clients.update, {
    id: 'client1',
    name: 'New Name',
  });
  expect(response).toHaveProperty('body');
});
