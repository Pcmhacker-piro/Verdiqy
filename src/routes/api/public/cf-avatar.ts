import { createFileRoute } from "@tanstack/react-router";
import { cfAvatarSources } from "@/lib/cf-avatar";

export const Route = createFileRoute("/api/public/cf-avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) {
          return new Response("Missing url", { status: 400 });
        }

        let sources: string[];
        try {
          sources = cfAvatarSources(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        for (const source of sources) {
          try {
            const upstream = await fetch(source, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
              },
              redirect: "error",
              signal: AbortSignal.timeout(8000),
            });
            const contentType = upstream.headers.get("content-type") ?? "";
            if (!upstream.ok || !upstream.body || !contentType.startsWith("image/")) {
              await upstream.body?.cancel();
              continue;
            }
            return new Response(upstream.body, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              },
            });
          } catch {
            // Try the other official host, never a generated replacement.
          }
        }
        return new Response("Codeforces photo temporarily unavailable", {
          status: 502,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
