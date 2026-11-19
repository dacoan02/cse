import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Consiliul Școlar al Elevilor",
    short_name: "Consiliul Elevilor",
    description: "Platformă digitală pentru organizarea și administrarea activității Consiliului Școlar al Elevilor.",
    lang: "ro",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fc",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
