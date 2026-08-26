import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wikiTest",
    short_name: "wikiTest",
    description: "多方位學習平台",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1e1e1e",
    theme_color: "#1e1e1e",
    lang: "zh-TW",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}