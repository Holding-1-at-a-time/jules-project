import { action } from '../_generated/server';
import { v } from 'convex/values';
import { api } from '../_generated/api';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

export const chat = action({
  args: {
    message: v.string(),
    clientId: v.id('clients'),
    tenantId: v.id('tenants'),
  },
  handler: async (ctx, { message, clientId, tenantId }) => {
    // 1. Save user message
    await ctx.runMutation(api.chat.send, {
      clientId,
      tenantId,
      message,
      from: 'user',
    });

    // 2. Fetch context
    const client = await ctx.runQuery(api.clients.get, { id: clientId });
    const tenant = await ctx.runQuery(api.tenants.get, { id: tenantId });
    const bookings = await ctx.runQuery(api.bookings.getForClient, { clientId });
    const assessments = await ctx.runQuery(api.assessments.getForClient, { clientId });

    // 3. Construct prompt
    const prompt = `
      You are a customer concierge for ${tenant?.name}.
      The customer's name is ${client?.name}.

      Here is some context about the customer:
      - Bookings: ${JSON.stringify(bookings)}
      - Assessments: ${JSON.stringify(assessments)}

      The customer said: "${message}"

      Please provide a helpful and friendly response.
    `;

    // 4. Call Ollama
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3',
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.response;

    // 5. Save AI response
    await ctx.runMutation(api.chat.send, {
      clientId,
      tenantId,
      message: aiResponse,
      from: 'ai',
    });

    return aiResponse;
  },
});
