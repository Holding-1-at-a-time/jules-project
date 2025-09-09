import { action } from '../_generated/server';
import { v } from 'convex/values';
import { api } from '../_generated/api';
const OLLAMA_ENDPOINT = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3';

// The main entry point for the AI Customer Concierge
export const chat = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, { message }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('User is not authenticated.');
    }

    const user = await ctx.runQuery(api.users.me);
    if (!user) {
      throw new Error('User not found.');
    }

    const client = await ctx.runQuery(api.clients.getByUserId, { userId: user._id });
    if (!client) {
      throw new Error('Client not found.');
    }

    const assessments = await ctx.runQuery(api.assessments.getForClient, {
      clientId: client._id,
      tenantId: client.tenantId,
    });

    const context = {
      user,
      client,
      assessments,
    };

    const prompt = `
      You are a customer concierge for a car detailing service.
      You are speaking to ${user.name}.
      Here is some context about the user and their vehicle(s):
      ${JSON.stringify(context, null, 2)}

      The user said: "${message}"

      Please provide a helpful and friendly response.
    `;

    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const ollamaResponse = await response.json();
    const aiResponse = ollamaResponse.response;

    await ctx.runMutation(api.chatHistory.add, {
      userId: user._id,
      userMessage: message,
      aiResponse,
    });

    return aiResponse;
  },
});
