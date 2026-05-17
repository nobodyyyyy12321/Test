import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Exam — 多方位測驗平台";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#f5efe6",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Exam
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#b19739",
            marginTop: 16,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          多方位測驗平台
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
