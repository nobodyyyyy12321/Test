import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "智人題庫",
    short_name: "智人題庫",
    description: "多方位學習平台",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "zh-TW",
    icons: [
      {
        src: "/icons/favicon.png",
        type: "image/png",
      }
    ],
  };
}