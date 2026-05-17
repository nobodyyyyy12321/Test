import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = { width: 1200, height: 630 };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Exam";
  const lang = searchParams.get("lang") || "zh-TW";
  const subtitle = lang === "en" ? "Practice Platform" : "多方位測驗平台";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: "#f5efe6",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 24,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#b19739",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
