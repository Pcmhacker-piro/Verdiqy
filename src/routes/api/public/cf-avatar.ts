import { createFileRoute } from "@tanstack/react-router";

// Codeforces blocks browsers from hotlinking profile photos (referer check),
// so we fetch the image server-side and stream it back. Only codeforces
// hosts are allowed, and nothing but the image bytes is returned.
function isAllowedHost(hostname: string): boolean {
  return (
    hostname === "codeforces.com" ||
    hostname === "codeforces.org" ||
    hostname.endsWith(".codeforces.org")
  );
}

export const Route = createFileRoute("/api/public/cf-avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) {
          return new Response("Missing url", { status: 400 });
        }

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }

        if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
          return new Response("Host not allowed", { status: 403 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(parsed.toString(), {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
            },
            redirect: "follow",
          });
        } catch {
          return new Response("Upstream error", { status: 502 });
        }

        if (!upstream.ok || !upstream.body) {
          return new Response("Not found", { status: 404 });
        }

        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        if (!contentType.startsWith("image/")) {
          return new Response("Not an image", { status: 404 });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      },
    },
  },
});
