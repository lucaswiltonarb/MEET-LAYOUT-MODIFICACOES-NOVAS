'use client';
import { useEffect, useState } from 'react';
import type { FakeParticipant } from '../components/FakeTile';

/**
 * Hook to fetch fake participants for a meeting and keep them refreshed.
 */
export default function useMeetingFakes(meetingId: string | undefined, intervalMs = 8000) {
  const [fakes, setFakes] = useState<FakeParticipant[]>([]);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    const fetchFakes = () => {
      fetch(`/api/meeting-fakes?meetingId=${meetingId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setFakes(d.fakes || []);
        })
        .catch(() => {});
    };
    fetchFakes();
    const t = setInterval(fetchFakes, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [meetingId, intervalMs]);

  return fakes;
}
