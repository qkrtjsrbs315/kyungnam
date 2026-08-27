/* Firebase Cloud Messaging 서비스 워커.
 * 등록 시 쿼리스트링(?config=...)으로 Firebase 설정을 전달받는다. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
const config = JSON.parse(params.get("config") || "{}");

if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // notification 페이로드는 브라우저가 자동 표시하므로, data 전용 메시지만 직접 표시한다
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return;
    const title = (payload.data && payload.data.title) || "경남산업 재고관리";
    const body = (payload.data && payload.data.body) || "";
    self.registration.showNotification(title, { body });
  });
}
