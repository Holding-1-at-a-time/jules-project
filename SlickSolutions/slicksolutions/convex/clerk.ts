import { httpAction } from './_generated/server';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/clerk-sdk-node';
import { internal } from './_generated/api';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export const fulfill = httpAction(async (ctx, request) => {
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set in the environment.');
  }

  const headers = request.headers;
  const payload = await request.text();

  const svix_id = headers.get('svix-id');
  const svix_timestamp = headers.get('svix-timestamp');
  const svix_signature = headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  const { id, ...attributes } = evt.data;
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const tenantId = await ctx.runMutation(internal.tenants.create, {
      name: `${attributes.first_name}'s Team`,
    });

    await ctx.runMutation(internal.users.create, {
      clerkId: id,
      email: attributes.email_addresses[0].email_address,
      name: `${attributes.first_name} ${attributes.last_name}`,
    });

    const user = await ctx.runQuery(internal.users.get, { clerkId: id });

    if (user) {
      await ctx.runMutation(internal.users.update, {
        id: user._id,
        tenantId: tenantId,
        roles: ['admin'],
      });
    }
  }

  return new Response('Webhook processed', { status: 200 });
});
