// Capacitor 네이티브 앱에서만 동작. 웹 브라우저에서는 no-op.
// @capacitor-firebase/messaging 사용 — iOS도 FCM 토큰 반환 (firebase-admin 호환).
// 로그인 성공(window 'fb-logged-in') 후 권한 요청 → 토큰 발급 → 서버 등록.
// 알림 탭 시 data.path 로 SPA 해시 라우팅.
(function () {
  function isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }
  if (!isNative()) return;

  const FM = window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseMessaging;
  if (!FM) {
    console.warn('[push] FirebaseMessaging plugin not found');
    return;
  }

  const platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'ios';
  let registeredToken = null;

  async function postToken(token) {
    if (!token || token === registeredToken) return;
    try {
      const r = await fetch('/api/devices/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, platform }),
      });
      if (r.ok) registeredToken = token;
    } catch (e) { console.warn('[push] register fetch failed', e); }
  }

  function applyDeepLink(data) {
    try {
      if (!data || !data.path) return;
      const path = String(data.path);
      if (path.startsWith('/')) location.href = path;
    } catch (e) { console.warn('[push] deeplink', e); }
  }

  FM.addListener('tokenReceived', (event) => {
    if (event && event.token) postToken(event.token);
  });
  FM.addListener('notificationActionPerformed', (action) => {
    applyDeepLink(action && action.notification && action.notification.data);
  });

  async function requestAndRegister() {
    try {
      let perm = await FM.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await FM.requestPermissions();
      }
      if (perm.receive === 'granted') {
        const r = await FM.getToken();
        if (r && r.token) postToken(r.token);
      }
    } catch (e) { console.warn('[push] request error', e); }
  }

  window.addEventListener('fb-logged-in', () => {
    requestAndRegister();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (j && j.authed) requestAndRegister();
    } catch {}
  });
})();
