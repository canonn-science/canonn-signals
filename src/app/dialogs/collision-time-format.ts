/**
 * Shared DST-aware local-time and duration formatting for the collision-family dialogs
 * (planetary and ring collisions): both show a contact window in the viewer's own time zone
 * alongside UTC, and a human-readable contact duration.
 */

/** The viewer's resolved IANA time zone (e.g. "Europe/Berlin"), for DST-correct local rendering. */
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Local wall-clock parts for `d` in the viewer's own time zone. Uses Intl with the resolved
 * IANA zone, so the offset is the one in effect *on that date* — summer vs winter (DST) is
 * honoured, rather than today's offset being assumed for a contact months away.
 */
function localParts(d: Date): { date: string; time: string; zone: string } {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-CA', {
    timeZone: localZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'shortOffset',
  }).formatToParts(d)) {
    parts[p.type] = p.value;
  }
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    time: `${parts['hour']}:${parts['minute']}:${parts['second']}`,
    zone: parts['timeZoneName'] ?? '',
  };
}

/** Local date-time "yyyy-MM-dd HH:mm:ss" for `d` in the viewer's zone (DST-aware). */
export function localDateTime(d: Date): string {
  const p = localParts(d);
  return `${p.date} ${p.time}`;
}

/** DST-correct UTC-offset label for `d` in the viewer's zone (e.g. "GMT+2" in summer, "GMT+1" in winter). */
export function localZoneLabel(d: Date): string {
  return localParts(d).zone;
}

/**
 * Duration between `startMs` and `endMs` as a human-readable string: e.g. "2 days 4 hours and 5
 * minutes". Any unit whose value is zero is omitted entirely.
 */
export function formatContactDuration(startMs: number, endMs: number): string {
  const totalMinutes = Math.round((endMs - startMs) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) { parts.push(`${days} day${days !== 1 ? 's' : ''}`); }
  if (hours > 0) { parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`); }
  if (minutes > 0) { parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`); }
  if (parts.length === 0) { return 'less than 1 minute'; }
  if (parts.length === 1) { return parts[0]; }
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}
