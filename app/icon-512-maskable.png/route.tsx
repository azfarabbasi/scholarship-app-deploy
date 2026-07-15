import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#185ada",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 220,
            fontWeight: 700,
            fontFamily: "sans-serif",
            color: "#ffffff",
          }}
        >
          S
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
