import JSXGraphDemo from "./JSXGraphDemo";

export default function JSXGraphPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold" style={{ color: "#b19739" }}>
        JSXGraph 座標平面範例
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--zen-ink)" }}>
        可拖曳點 A、B，並用滾輪縮放。範例同時包含一條直線與二次函數圖形。
      </p>

      <div className="mt-6">
        <JSXGraphDemo />
      </div>
    </main>
  );
}
