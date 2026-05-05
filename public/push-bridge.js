// Capacitor 네이티브 앱에서만 동작. 웹 브라우저에서는 no-op.
// 로그인 성공(window 'fb-logged-in' 이벤트) 후 FCM 토큰 발급 → 서버 등록.
// 알림 탭 시 data.path 로 SPA 해시 라우팅.
(function () {
  function isNative() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }
  if (!isNative()) return;

  const PN = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
  if (!PN) {
    console.warn('[push] PushNotifications plugin not found');
    return;
  }

  const platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'ios';

  let registeredToken = null;

  async function postToken(token) {
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
      if (path.startsWith('/')) {
        if (location.hash !== path.replace(/^\//, '')) location.href = path;
      }
    } catch (e) { console.warn('[push] deeplink', e); }
  }

  PN.addListener('registration', (t) => {
    if (t && t.value) postToken(t.value);
  });
  PN.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err);
  });
  PN.addListener('pushNotificationActionPerformed', (action) => {
    applyDeepLink(action && action.notification && action.notification.data);
  });

  async function requestAndRegister() {
    try {
      let perm = await PN.checkPermissions();
      if (perm.receive !== 'granted') {
        perm = await PN.requestPermissions();
      }
      if (perm.receive === 'granted') {
        await PN.register();
      }
    } catch (e) { console.warn('[push] request error', e); }
  }

  // 로그인 직후 권한 요청 (첫 로그인엔 OS 다이얼로그가 뜸)
  window.addEventListener('fb-logged-in', () => {
    requestAndRegister();
  });

  // 이미 로그인된 채로 앱이 시작된 경우 (재실행) — 토큰 등록만 갱신
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (j && j.authed) requestAndRegister();
    } catch {}
  });
})();
