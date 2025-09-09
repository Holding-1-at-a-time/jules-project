import { action } from '../_generated/server';
import { v } from 'convex/values';
import { api } from '../_generated/api';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

/**
 * Generates business recommendations for a tenant using the Ollama AI model.
 * This action is intended to be called by a cron job.
 *
 * @param tenantId The ID of the tenant to generate recommendations for.
 */
export const generateRecommendation = action({
  args: {
    tenantId: v.id('tenants'),
  },
  handler: async (ctx, { tenantId }) => {
    // 1. Fetch context
    const tenant = await ctx.runQuery(api.tenants.get, { id: tenantId });
    const assessments = await ctx.runQuery(api.assessments.getForTenant, { tenantId });
    const bookings = await ctx.runQuery(api.bookings.getForTenant, { tenantId });
    // Note: We might need more granular analytics data in a real application.

    // 2. Construct prompt
    const prompt = `
      You are a business optimizer AI for ${tenant?.name}.
      Your goal is to provide actionable recommendations to improve the business.

      Here is some data for the last period:
      - Assessments: ${JSON.stringify(assessments)}
      - Bookings: ${JSON.stringify(bookings)}

      Based on this data, please provide recommendations for:
      - Dynamic pricing adjustments
      - Scheduling optimization
      - Inventory alerts (if applicable)

      Please provide a concise and actionable report.
    `;

    // 3. Call Ollama
    let data;
    try {
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
        const errorBody = await response.text();
        throw new Error(`Ollama request failed with status ${response.status}: ${errorBody}`);
      }

      data = await response.json();
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw new Error('Failed to get a response from the AI model.');
    }

    if (!data || !data.response) {
      throw new Error('Invalid response format from AI model');
    }
    const recommendation = data.response;

    // 4. Save recommendation
    await ctx.runMutation(api.recommendations.create, {
      tenantId,
      content: recommendation,
    });

    // 5. Send notification (placeholder)
    console.log(`Notification: New business insights available for ${tenant?.name}`);
  },
});
