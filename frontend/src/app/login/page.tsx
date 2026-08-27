"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { saveLogin } from "@/lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await api<{ token: string; username: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      saveLogin(r.token, r.username);
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold">경남산업</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">재고관리 시스템 로그인</p>

        <label className="block text-xs text-gray-500 mb-1.5">아이디</label>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <label className="block text-xs text-gray-500 mb-1.5">비밀번호</label>
        <input
          type="password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 text-white font-bold py-3 disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
