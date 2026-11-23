/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago": how long before `now` a moment was. */
export function agoWords(at: string | number | Date, now: string | number | Date = Date.now()): string {
  const minutes = Math.floor((new Date(now).getTime() - new Date(at).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
