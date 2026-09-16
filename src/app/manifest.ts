import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Copilot Admin Embraer",
    short_name: "Copilot Admin",
    description: "Seats, cost centers, budgets e consumo do GitHub Copilot na enterprise",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1013",
    theme_color: "#1d4ed8",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
