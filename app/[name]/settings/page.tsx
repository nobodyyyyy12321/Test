"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [emailPublic, setEmailPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    const nameParam = params?.name;
    if (!nameParam || typeof nameParam !== "string") {
      router.push("/");
      return;
    }

    const decodedName = decodeURIComponent(nameParam);

    // Fetch the profile for the requested name and allow access if the API marks the requester as owner
    (async () => {
      try {
        const res = await fetch(`/api/user/profile?name=${encodeURIComponent(decodedName)}`);
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        if (!data?.user) {
          router.push("/");
          return;
        }

        // If API indicates this requester is the owner, allow and load settings
        if (data.user.isOwner) {
          setEmailPublic(data.user.emailPublic ?? false);
          setLoading(false);
          return;
        }

        // Not owner — redirect away
        router.push("/");
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        router.push("/");
      }
    })();
  }, [status, session, router, params]);

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPublic }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存失敗");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (e) {
      setError("保存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent dark:bg-black">
        <main className="w-full max-w-2xl p-8 text-center">
          <p className="text-sm zen-subtle">載入中...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black">
        <div className="w-full max-w-md mb-8">
          <h1 className="text-4xl font-bold zen-title mb-2">設定</h1>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">隱私設定</h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailPublic}
                    onChange={(e) => setEmailPublic(e.target.checked)}
                    className="w-5 h-5 mt-0.5"
                  />
                  <div>
                    <div className="font-medium">公開電子郵件</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      允許其他使用者在您的個人資料頁面查看您的電子郵件
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="zen-button px-6 py-2 rounded disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              {success && <span className="text-sm text-green-600">已保存</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
