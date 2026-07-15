import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScholarTrack",
    short_name: "ScholarTrack",
    description:
      "Discover, track, and plan verified scholarship and internship opportunities. Guest data stays on your device.",
    start_url: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f8fb",
    theme_color: "#185ada",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
