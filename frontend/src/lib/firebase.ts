// Firebase Cloud Messaging(FCM) - 푸시 알림 클라이언트
// .env.local 의 NEXT_PUBLIC_FIREBASE_* 값이 모두 있어야 동작한다.
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import { api } from "./api";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/** 알림 권한 요청 → FCM 토큰 발급 → 백엔드에 등록 */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
  if (!firebaseConfigured()) {
    throw new Error("Firebase 설정이 없습니다. .env.local 의 NEXT_PUBLIC_FIREBASE_* 값을 채워주세요.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 거부되었습니다.");

  // 서비스 워커에 Firebase 설정을 쿼리스트링으로 전달 (SW는 env를 읽을 수 없음)
  const params = new URLSearchParams({ config: JSON.stringify(firebaseConfig) });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);

  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("FCM 토큰 발급에 실패했습니다.");

  await api("/notifications/tokens", { method: "POST", body: JSON.stringify({ token }) });
}
