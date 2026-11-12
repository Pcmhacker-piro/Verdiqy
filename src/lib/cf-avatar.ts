// Keep the original uploaded photo path; Codeforces also serves userpic
// images under /userpic/ on its main site when the photo host is unavailable.
export function cfAvatarSources(value: string): string[] {
  const url = new URL(value.startsWith("//") ? `https:${value}` : value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
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

// Prefer official images directly: private preview gateways can reject image
// proxy requests even though the same public endpoint works after publishing.
export function cfAvatarCandidates(titlePhoto?: string | null, avatar?: string | null): string[] {
  const photos = [titlePhoto, avatar].filter((photo): photo is string => Boolean(photo));
  const uploaded = photos.filter((photo) => !/\/no-(title|avatar)\./.test(photo));
  const ordered = [...uploaded, ...photos];
  const candidates: string[] = [];
  for (const photo of ordered) {
    try {
      candidates.push(...cfAvatarSources(photo));
      const proxy = cfAvatarUrl(photo);
      if (proxy) candidates.push(proxy);
    } catch {
      // Never send an untrusted image host to the browser or proxy.
    }
  }
  return [...new Set(candidates)];
}
