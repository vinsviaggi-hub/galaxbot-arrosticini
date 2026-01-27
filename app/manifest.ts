import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arrosticini Abruzzesi",
    short_name: "Arrosticini",
    description: "Prenotazioni scatole 50/100/200",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f18",
    theme_color: "#0b0f18",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
  };
}
