import { isAdmin } from '@/lib/adminAuth';

export async function GET() {
  const ok = await isAdmin();
  return Response.json({ authenticated: ok });
}
