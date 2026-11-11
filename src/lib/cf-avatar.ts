// Builds a same-origin URL that serves a Codeforces profile photo through
// our server-side proxy (Codeforces blocks direct browser hotlinking).
export function cfAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return `/api/public/cf-avatar?url=${encodeURIComponent(url)}`;
}
