import { createFileRoute } from "@tanstack/react-router";

// Runtime configuration endpoint for the Google Maps browser key.
// Reads from server env at request time so the published bundle does not
// need the key baked in at build time. Only public, referrer-restricted
// values are returned here (safe to expose to the browser).
export const Route = createFileRoute("/api/public/maps-config")({
  server: {
    handlers: {
      GET: async () => {
        const browserKey =
          process.env.GOOGLE_MAPS_BROWSER_KEY ??
          process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ??
          "";
        const trackingId =
          process.env.GOOGLE_MAPS_TRACKING_ID ??
          process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID ??
          "";

        return new Response(
          JSON.stringify({ browserKey, trackingId }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
