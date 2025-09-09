import { action } from '../_generated/server';
import { v } from 'convex/values';
import { api } from '../_generated/api';
import { Ollama, StreamingTextResponse } from 'ai';
import { createAppointmentTool, updateClientInfoTool } from './tools';

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const ollama = new Ollama({
  baseURL: OLLAMA_ENDPOINT,
});

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

      Please provide a helpful and friendly response. You have access to the following tools:
      - createAppointment: Create a new appointment for a client.
      - updateClientInfo: Update a client's information.
    `;

    const { stream, messages } = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      tools: [createAppointmentTool, updateClientInfoTool],
      tool_choice: 'auto',
    });

    let aiResponse = '';
    const toolCalls = [];
    for await (const chunk of stream) {
      if (chunk.type === 'tool_call') {
        toolCalls.push(chunk);
      }
      aiResponse += chunk.delta || '';
    }

    if (toolCalls.length > 0) {
      const toolCallResults = [];
      for (const toolCall of toolCalls) {
        const { toolName, args } = toolCall;
        let result;
        if (toolName === 'createAppointment') {
          result = await ctx.runMutation(api.appointments.create, args);
        } else if (toolName === 'updateClientInfo') {
          result = await ctx.runMutation(api.clients.update, args);
        }
        toolCallResults.push(result);
      }
      const newResponse = await ollama.chat({
        model: OLLAMA_MODEL,
        messages: [...messages, { role: 'tool', content: JSON.stringify(toolCallResults) }],
        stream: true,
      });
      // Save the AI's response to the chat history
      const [stream1, stream2] = newResponse.stream.tee();
      let finalResponse = '';
      for await (const chunk of stream1) {
        finalResponse += chunk.delta;
      }
      await ctx.runMutation(api.chatHistory.add, {
        userId: user._id,
        userMessage: message,
        aiResponse: finalResponse,
      });
      return new StreamingTextResponse(stream2);
    }

    await ctx.runMutation(api.chatHistory.add, {
      userId: user._id,
      userMessage: message,
      aiResponse,
    });

    return new StreamingTextResponse(stream);
  },
});
