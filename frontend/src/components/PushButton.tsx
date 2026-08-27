"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { enablePush, firebaseConfigured, pushSupported } from "@/lib/firebase";

type State = "idle" | "unsupported" | "working" | "enabled";

export default function PushButton() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (!pushSupported()) {
      setState("unsupported");
    } else if (Notification.permission === "granted") {
      setState("enabled");
    }
  }, []);

  if (state === "unsupported") return null;

  async function enable() {
    setState("working");
    try {
      await enablePush();
      setState("enabled");
      alert("푸시 알림이 켜졌습니다. 재고 부족 시 이 기기로 알림이 옵니다.");
    } catch (e) {
      setState(Notification.permission === "granted" ? "enabled" : "idle");
      alert((e as Error).message);
    }
  }

  async function sendTest() {
    try {
      const r = await api<{ sent: number; errors?: string[] }>("/notifications/test", { method: "POST" });
      if (r.sent === 0) {
        alert("발송 실패:\n" + (r.errors?.join("\n") || "백엔드 설정과 토큰 등록을 확인해주세요."));
      } else if (r.errors && r.errors.length > 0) {
        alert(`${r.sent}건 발송 성공, 일부 실패:\n` + r.errors.join("\n"));
      }
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mt-4 md:mt-8 px-2 flex md:flex-col gap-2 items-center md:items-stretch shrink-0">
      {state !== "enabled" ? (
        <button
          onClick={enable}
          disabled={state === "working"}
          className="w-full rounded-lg border border-gray-700 text-slate-300 hover:text-white hover:bg-gray-800 px-3 py-2 text-sm font-bold disabled:opacity-50 whitespace-nowrap"
          title={firebaseConfigured() ? "재고 부족 푸시 알림 켜기" : "Firebase 설정 후 사용 가능"}
        >
          {state === "working" ? "설정 중..." : "🔔 푸시 알림 켜기"}
        </button>
      ) : (
        <>
          <span className="text-xs text-emerald-400 font-bold px-1 whitespace-nowrap">🔔 알림 켜짐</span>
          <button
            onClick={sendTest}
            className="w-full rounded-lg border border-gray-700 text-slate-300 hover:text-white hover:bg-gray-800 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
          >
            테스트 발송
          </button>
        </>
      )}
    </div>
  );
}
