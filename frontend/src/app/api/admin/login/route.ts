import { checkAdminPassword, setAdminSessionCookie } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const { password } = await request.json();
  if (!checkAdminPassword(password || '')) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  await setAdminSessionCookie();
  return Response.json({ ok: true });
}
