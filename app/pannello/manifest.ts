import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pannello Prenotazioni",
    short_name: "Pannello",
    start_url: "/pannello",
    scope: "/pannello",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#f4f6fb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
  };
}
