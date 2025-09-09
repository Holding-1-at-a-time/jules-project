import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/clerk-sdk-node';
import { internal } from './_generated/api';

const http = httpRouter();

const handleClerkWebhook = httpAction(async (ctx, request) => {
  const event = await validateRequest(request);
  if (!event) {
    return new Response('Invalid request', { status: 400 });
  }

  switch (event.type) {
    case 'user.created':
    case 'user.updated':
      await ctx.runMutation(internal.users.createOrUpdateUser, {
        clerkId: event.data.id,
        email: event.data.email_addresses[0]?.email_address,
        name: `${event.data.first_name} ${event.data.last_name}`,
      });
      break;
    case 'user.deleted':
      await ctx.runMutation(internal.users.deleteUser, {
        clerkId: event.data.id as string,
      });
      break;
    default:
      console.log('Unhandled Clerk webhook event:', event.type);
  }

  return new Response(null, { status: 200 });
});

http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: handleClerkWebhook,
});

async function validateRequest(
  request: Request
): Promise<WebhookEvent | undefined> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set');
  }

  const payloadString = await request.text();
  const svixHeaders = {
    'svix-id': request.headers.get('svix-id')!,
    'svix-timestamp': request.headers.get('svix-timestamp')!,
    'svix-signature': request.headers.get('svix-signature')!,
  };

  const wh = new Webhook(webhookSecret);
  try {
    const event = wh.verify(payloadString, svixHeaders) as WebhookEvent;
    return event;
  } catch (error) {
    console.error('Error verifying Clerk webhook:', error);
    return undefined;
  }
}

export default http;
