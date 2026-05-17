import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Exam";
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
          alignItems: "center",
          justifyContent: "center",
          background: "#1e1e1e",
        }}
      >
        <span
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: "#f5efe6",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Exam
        </span>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
