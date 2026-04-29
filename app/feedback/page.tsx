"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  type LanguageCode = "zh-TW" | "zh-CN" | "en" | "es" | "ru" | "th" | "id" | "ko";
  const [language, setLanguage] = useState<LanguageCode>("zh-TW");

  useEffect(() => {
    const stored = (localStorage.getItem("siteLanguage") as LanguageCode) || "zh-TW";
    setLanguage(stored);
    const handler = () => {
      const updated = (localStorage.getItem("siteLanguage") as LanguageCode) || "zh-TW";
      setLanguage(updated);
    };
    window.addEventListener("site-language-change", handler);
    return () => window.removeEventListener("site-language-change", handler);
  }, []);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;
  }, [name, email, message]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || sending) return;

    setSending(true);
    setStatus("idle");
    setStatusText("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          pageUrl: window.location.href,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setStatusText(data?.error || "送出失敗，請稍後再試。");
        return;
      }

      setStatus("success");
      setStatusText("回饋已送出，謝謝你！");
      setMessage("");
    } catch {
      setStatus("error");
      setStatusText("網路連線異常，請稍後再試。");
    } finally {
      setSending(false);
    }
  }

  const dict: Record<LanguageCode, {
    title: string;
    desc: string;
    name: string;
    email: string;
    content: string;
    placeholderName: string;
    placeholderEmail: string;
    placeholderContent: string;
    sending: string;
    send: string;
    success: string;
    error: string;
    netError: string;
  }> = {
    "zh-TW": {
      title: "意見回饋",
      desc: "有任何建議、問題或想法，歡迎留言給我們。",
      name: "名稱",
      email: "Email",
      content: "回饋內容",
      placeholderName: "你的名稱",
      placeholderEmail: "you@example.com",
      placeholderContent: "請輸入你想告訴我們的內容",
      sending: "送出中...",
      send: "送出回饋",
      success: "回饋已送出，謝謝你！",
      error: "送出失敗，請稍後再試。",
      netError: "網路連線異常，請稍後再試。"
    },
    "zh-CN": {
      title: "意见反馈",
      desc: "有任何建议、问题或想法，欢迎留言给我们。",
      name: "名称",
      email: "Email",
      content: "反馈内容",
      placeholderName: "你的名称",
      placeholderEmail: "you@example.com",
      placeholderContent: "请输入你想告诉我们的内容",
      sending: "发送中...",
      send: "发送反馈",
      success: "反馈已发送，感谢你！",
      error: "发送失败，请稍后再试。",
      netError: "网络连接异常，请稍后再试。"
    },
    "en": {
      title: "Feedback",
      desc: "Any suggestions, questions or ideas? Leave us a message.",
      name: "Name",
      email: "Email",
      content: "Feedback",
      placeholderName: "Your name",
      placeholderEmail: "you@example.com",
      placeholderContent: "Please enter your feedback",
      sending: "Sending...",
      send: "Send Feedback",
      success: "Feedback sent, thank you!",
      error: "Failed to send, please try again later.",
      netError: "Network error, please try again later."
    },
    "es": {
      title: "Retroalimentación",
      desc: "¿Tienes sugerencias, preguntas o ideas? Déjanos un mensaje.",
      name: "Nombre",
      email: "Email",
      content: "Retroalimentación",
      placeholderName: "Tu nombre",
      placeholderEmail: "you@example.com",
      placeholderContent: "Por favor ingresa tus comentarios",
      sending: "Enviando...",
      send: "Enviar comentarios",
      success: "¡Comentarios enviados, gracias!",
      error: "Error al enviar, inténtalo de nuevo más tarde.",
      netError: "Error de red, inténtalo de nuevo más tarde."
    },
    "ru": {
      title: "Обратная связь",
      desc: "Есть предложения, вопросы или идеи? Оставьте нам сообщение.",
      name: "Имя",
      email: "Email",
      content: "Обратная связь",
      placeholderName: "Ваше имя",
      placeholderEmail: "you@example.com",
      placeholderContent: "Пожалуйста, введите ваш отзыв",
      sending: "Отправка...",
      send: "Отправить отзыв",
      success: "Отзыв отправлен, спасибо!",
      error: "Не удалось отправить, попробуйте позже.",
      netError: "Ошибка сети, попробуйте позже."
    }
    ,
    "th": {
      title: "ข้อเสนอแนะ",
      desc: "หากคุณมีข้อเสนอแนะ คำถาม หรือไอเดียใด ๆ กรุณาฝากข้อความถึงเรา",
      name: "ชื่อ",
      email: "อีเมล",
      content: "ข้อเสนอแนะ",
      placeholderName: "ชื่อของคุณ",
      placeholderEmail: "you@example.com",
      placeholderContent: "กรุณากรอกข้อเสนอแนะของคุณ",
      sending: "กำลังส่ง...",
      send: "ส่งข้อเสนอแนะ",
      success: "ส่งข้อเสนอแนะเรียบร้อย ขอบคุณค่ะ!",
      error: "ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      netError: "เครือข่ายผิดพลาด กรุณาลองใหม่อีกครั้ง"
    },
    "id": {
      title: "Masukan",
      desc: "Ada saran, pertanyaan, atau ide? Tinggalkan pesan untuk kami.",
      name: "Nama",
      email: "Email",
      content: "Masukan",
      placeholderName: "Nama Anda",
      placeholderEmail: "you@example.com",
      placeholderContent: "Silakan masukkan masukan Anda",
      sending: "Mengirim...",
      send: "Kirim Masukan",
      success: "Masukan telah dikirim, terima kasih!",
      error: "Gagal mengirim, silakan coba lagi nanti.",
      netError: "Kesalahan jaringan, silakan coba lagi nanti."
    },
    "ko": {
      title: "피드백",
      desc: "제안, 질문 또는 아이디어가 있으신가요? 메시지를 남겨주세요.",
      name: "이름",
      email: "이메일",
      content: "피드백",
      placeholderName: "이름을 입력하세요",
      placeholderEmail: "you@example.com",
      placeholderContent: "피드백을 입력해 주세요",
      sending: "전송 중...",
      send: "피드백 보내기",
      success: "피드백이 전송되었습니다. 감사합니다!",
      error: "전송에 실패했습니다. 나중에 다시 시도해 주세요.",
      netError: "네트워크 오류입니다. 나중에 다시 시도해 주세요."
    }
  };
  const t = dict[language as LanguageCode] || dict["zh-TW"];

  return (
<div className="flex items-center justify-center min-h-screen bg-transparent px-6 py-16 font-sans dark:bg-black">
  {/* 確保 main 沒有設定固定高度，使用 h-fit 確保高度緊貼內容 */}
  <main className="w-full max-w-2xl zen-card p-8 mx-auto mt-12 h-fit">
        <p className="zen-subtle mb-8">{t.desc}</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="feedback-name" className="block mb-1 text-sm">{t.name}</label>
            <input
              id="feedback-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2"
              placeholder={t.placeholderName}
              required
            />
          </div>

          <div>
            <label htmlFor="feedback-email" className="block mb-1 text-sm">{t.email}</label>
            <input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2"
              placeholder={t.placeholderEmail}
              required
            />
          </div>

          <div>
            <label htmlFor="feedback-message" className="block mb-1 text-sm">{t.content}</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={8}
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2"
              placeholder={t.placeholderContent}
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit || sending}
              className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 border rounded-full bg-white text-black text-sm leading-none cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? t.sending : t.send}
            </button>
            {status !== "idle" && (
              <p className={status === "success" ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
                {statusText}
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
