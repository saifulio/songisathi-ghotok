// Pure formatters shared by the view mappers and the routes. Nothing here
// touches the DB or the request.

export const STATUS_LABEL = {
  DRAFT: 'Draft', ACTIVE: 'Active', IN_DISCUSSION: 'In discussion',
  MATCH_IN_PROGRESS: 'Match in progress', MARRIED: 'Married',
  AUTO_ARCHIVED: 'Auto-archived', PAUSED: 'Paused',
};

export const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const yearsSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null);
export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

export const capWord = (x) => (x ? x[0] + x.slice(1).toLowerCase() : x);
export const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Rough education level from the free-text degree (no dedicated column).
export const eduLevelOf = (degree) =>
  /\b(m\.?a|m\.?sc|m\.?eng|mba|mbbs|mphil|ph\.?d|llm|masters|postgrad)/i.test(degree || '')
    ? 'Postgraduate' : 'Graduate';

// Coarse "2 hours ago" / "Yesterday" / "Last week" phrasing for interest timestamps.
export function relativeTime(d) {
  if (!d) return '';
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  if (day < 14) return 'Last week';
  return `${Math.floor(day / 7)} weeks ago`;
}
