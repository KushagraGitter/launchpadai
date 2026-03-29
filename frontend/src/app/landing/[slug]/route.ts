/**
 * Landing page route handler.
 *
 * Proxies the AI-generated HTML from the FastAPI backend and serves it as a
 * raw HTML response from the Next.js domain. This ensures:
 *   - The iframe preview is same-origin (no CSP / X-Frame-Options issues)
 *   - The full AI-generated <head> (title, OG meta) is preserved for SEO
 *   - Lead capture forms use relative /api/... URLs that proxy to FastAPI
 *
 * Public URL: GET /landing/{slug}
 */
import { NextRequest, NextResponse } from "next/server";

// Internal API URL (server-side only, never exposed to the browser).
// Prefer the non-public env var so the browser never sees it.
const BACKEND =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const res = await fetch(`${BACKEND}/api/landing/${params.slug}`, {
      // Cache for 30s at the CDN / Next.js data cache layer
      next: { revalidate: 30 },
    });

    const html = await res.text();

    if (!res.ok) {
      // Return a styled 404 page rather than leaking backend error details
      return new NextResponse(
        `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Page Not Found</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh}h1{font-size:2rem;font-weight:700;margin-bottom:.5rem}p{color:#888}</style>
</head>
<body><div style="text-align:center"><h1>Page Not Found</h1><p>This landing page doesn't exist or hasn't been published yet.</p></div></body>
</html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Allow CDN / browser to cache for 30s, serve stale for up to 60s
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        // Allow embedding in an iframe on the same origin (the dashboard preview)
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err) {
    console.error("[landing-route] Failed to fetch from backend:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
