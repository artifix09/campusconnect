import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CampusConnect",
    short_name: "CampusConnect",
    description: "Report campus issues and track them until they are resolved.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e9ece9",
    theme_color: "#e9ece9",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Report an issue", short_name: "Report", url: "/student/complaints/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My complaints", short_name: "Complaints", url: "/student/complaints" },
    ],
  };
}
