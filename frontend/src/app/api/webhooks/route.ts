import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { StreamClient } from '@stream-io/node-sdk';

const VIDEO_API_KEY = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!;
const VIDEO_SECRET = process.env.STREAM_VIDEO_API_SECRET!;
const CHAT_API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;
const CHAT_SECRET = process.env.STREAM_CHAT_API_SECRET!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    return new Response(
      'WEBHOOK_SECRET not set. Add it to .env.local from your Clerk Dashboard webhook signing secret.',
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', { status: 400 });
  }

  const eventType = evt.type;

  switch (eventType) {
    case 'user.created':
    case 'user.updated': {
      const newUser = evt.data;
      const userPayload = {
        id: newUser.id,
        role: 'user',
        name: `${newUser.first_name ?? ''} ${newUser.last_name ?? ''}`.trim() || (newUser.username ?? 'User'),
        custom: {
          username: newUser.username,
          email: newUser.email_addresses?.[0]?.email_address,
        },
        image: newUser.has_image ? newUser.image_url : undefined,
      };

      const videoClient = new StreamClient(VIDEO_API_KEY, VIDEO_SECRET);
      const chatClient = new StreamClient(CHAT_API_KEY, CHAT_SECRET);

      await Promise.allSettled([
        videoClient.upsertUsers([userPayload]),
        chatClient.upsertUsers([userPayload]),
      ]);
      break;
    }
    default:
      break;
  }

  return new Response('Webhook processed', { status: 200 });
}
