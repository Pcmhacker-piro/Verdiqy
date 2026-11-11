// Keep the original uploaded photo path; Codeforces also serves userpic
// images under /userpic/ on its main site when the photo host is unavailable.
export function cfAvatarSources(value: string): string[] {
  const url = new URL(value.startsWith("//") ? `https:${value}` : value);
  if (
    url.protocol !== "https:" ||
    url.username || url.password || url.port ||
    !["codeforces.com", "codeforces.org", "userpic.codeforces.org"].includes(url.hostname)
  ) {
    throw new Error("Unsupported Codeforces image URL");
  }
  if (url.hostname === "userpic.codeforces.org") {
    return [`https://codeforces.com/userpic${url.pathname}${url.search}`, url.href];
  }
  return [url.href];
}

export function cfAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return `/api/public/cf-avatar?url=${encodeURIComponent(url)}`;
}
