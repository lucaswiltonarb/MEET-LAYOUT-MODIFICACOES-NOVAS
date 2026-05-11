import { getDb } from '@/lib/db';

/**
 * GET /api/meeting-fakes?meetingId=...
 * Public endpoint - returns fake participants for a meeting so they can be
 * rendered in the meeting grid by any client.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get('meetingId');
  if (!meetingId) return Response.json({ fakes: [] });
  const db = await getDb();
  const fakes = await db.collection('fake_profiles').find({ meetingId, active: true }).toArray();
  return Response.json({
    fakes: fakes.map((f) => ({
      _id: String(f._id),
      streamId: `fake_${String(f._id)}`,
      name: f.name,
      avatarColor: f.avatarColor,
      imageUrl: f.imageUrl || null,
    })),
  });
}
