// FCM 푸시 발송 모듈.
// FIREBASE_SERVICE_ACCOUNT_JSON (JSON 문자열) 또는 FIREBASE_SERVICE_ACCOUNT_PATH (파일 경로) 환경변수가
// 있어야 활성화. 없으면 sendPush()는 no-op으로 떨어져서 dev 환경에서도 안전.
const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

let admin = null;
let messaging = null;
let initState = 'pending'; // 'pending' | 'ready' | 'disabled'

function init() {
  if (initState !== 'pending') return;
  try {
    const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    let credentialJson = null;
    if (jsonStr && jsonStr.trim().startsWith('{')) {
      credentialJson = JSON.parse(jsonStr);
    } else if (jsonPath) {
      const abs = path.isAbsolute(jsonPath) ? jsonPath : path.join(__dirname, jsonPath);
      if (fs.existsSync(abs)) credentialJson = JSON.parse(fs.readFileSync(abs, 'utf8'));
    }
    if (!credentialJson) {
      console.warn('[push] FIREBASE_SERVICE_ACCOUNT 미설정 — 푸시 비활성');
      initState = 'disabled';
      return;
    }
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credentialJson) });
    }
    messaging = admin.messaging();
    initState = 'ready';
    console.log('[push] firebase-admin ready (project:', credentialJson.project_id, ')');
  } catch (e) {
    console.warn('[push] init failed:', e.message);
    initState = 'disabled';
  }
}

async function tokensForUsers(userIds) {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  const [rows] = await getPool().query(
    `SELECT token, platform FROM device_tokens WHERE user_id IN (${placeholders})`,
    userIds
  );
  return rows;
}

async function pruneInvalidTokens(invalidTokens) {
  if (!invalidTokens.length) return;
  const placeholders = invalidTokens.map(() => '?').join(',');
  await getPool().query(
    `DELETE FROM device_tokens WHERE token IN (${placeholders})`,
    invalidTokens
  );
  console.log('[push] pruned', invalidTokens.length, 'invalid tokens');
}

// userIds: 발송 대상 user_id 배열
// title, body: 알림 제목/본문
// data: 클릭 시 앱이 받는 추가 페이로드 (예: { kind: 'chat', path: '/chat' })
async function sendPush(userIds, { title, body, data } = {}) {
  init();
  if (initState !== 'ready') return { sent: 0, skipped: true };
  const rows = await tokensForUsers(userIds);
  if (!rows.length) return { sent: 0 };

  const tokens = rows.map(r => r.token);
  const dataPayload = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) dataPayload[k] = String(v);
  }

  try {
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: title || '가족보드', body: body || '' },
      data: dataPayload,
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'familyboard_default' },
      },
    });
    const invalid = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') ||
            code.includes('invalid-argument') ||
            code.includes('invalid-registration-token')) {
          invalid.push(tokens[i]);
        } else {
          console.warn('[push] send error:', code, r.error?.message);
        }
      }
    });
    if (invalid.length) await pruneInvalidTokens(invalid);
    return { sent: resp.successCount, failed: resp.failureCount };
  } catch (e) {
    console.warn('[push] send exception:', e.message);
    return { sent: 0, error: e.message };
  }
}

// 가족 전체 멤버 user_id 조회 (특정 user_id 제외 가능)
async function familyUserIds(familyId, excludeUserId = null) {
  const [rows] = await getPool().query(
    'SELECT id FROM users WHERE family_id = ?',
    [familyId]
  );
  return rows.map(r => r.id).filter(id => id !== excludeUserId);
}

module.exports = { sendPush, familyUserIds };
