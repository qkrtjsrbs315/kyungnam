"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUsername, logout } from "@/lib/auth";

export default function AccountBox() {
  const [username, setUsername] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(getUsername() ?? "");
  }, []);

  async function changePassword() {
    if (next.length < 8) {
      alert("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (next !== confirm) {
      alert("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      alert("비밀번호가 변경되었습니다.");
      setShowModal(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm";

  return (
    <div className="mt-3 px-2 flex md:flex-col gap-2 items-center md:items-stretch shrink-0">
      <span className="text-xs text-gray-500 px-1 whitespace-nowrap hidden md:block">👤 {username}</span>
      <button
        onClick={() => setShowModal(true)}
        className="w-full rounded-lg border border-gray-700 text-slate-300 hover:text-white hover:bg-gray-800 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
      >
        비밀번호 변경
      </button>
      <button
        onClick={logout}
        className="w-full rounded-lg border border-gray-700 text-slate-300 hover:text-white hover:bg-gray-800 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
      >
        로그아웃
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center p-4 z-30">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 text-gray-900">
            <h2 className="text-lg font-extrabold mb-4">비밀번호 변경</h2>
            <label className="block text-xs text-gray-500 mb-1.5">현재 비밀번호</label>
            <input type="password" className={`${input} mb-3`} value={current} onChange={(e) => setCurrent(e.target.value)} />
            <label className="block text-xs text-gray-500 mb-1.5">새 비밀번호 (8자 이상)</label>
            <input type="password" className={`${input} mb-3`} value={next} onChange={(e) => setNext(e.target.value)} />
            <label className="block text-xs text-gray-500 mb-1.5">새 비밀번호 확인</label>
            <input type="password" className={`${input} mb-4`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 font-bold text-sm">
                취소
              </button>
              <button
                onClick={changePassword}
                disabled={saving}
                className="rounded-lg bg-gray-900 text-white px-4 py-2 font-bold text-sm disabled:opacity-50"
              >
                {saving ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
