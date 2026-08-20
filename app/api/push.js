import webpush from 'web-push'
import { sendJson } from './_serviceKey.js'

// 채팅이 오면 가족의 다른 기기로 푸시를 보낸다.
//
// 보내는 쪽 클라이언트가 이 엔드포인트를 부른다. Supabase Database Webhook을 쓰지
// 않는 이유는, 메시지를 보낸 사람은 정의상 지금 접속해 있어서 굳이 DB가 대신
// 알려줄 필요가 없기 때문이다. 웹훅을 쓰면 설정이 Dashboard 안으로 숨어서
// 저장소만 봐서는 알림이 어디서 나가는지 알 수 없게 된다.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

function vapidReady() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  // 공개키는 브라우저가 구독할 때 필요하다. 환경변수를 VITE_로 한 벌 더 두면
  // 개인키와 짝이 어긋날 여지가 생기므로, 여기서 같은 출처로 내려준다.
  if (req.method === 'GET') {
    if (!vapidReady()) return sendJson(res, 200, { enabled: false })
    return sendJson(res, 200, { enabled: true, publicKey: process.env.VAPID_PUBLIC_KEY })
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
  if (!vapidReady()) return sendJson(res, 503, { error: '푸시 키가 설정되지 않았어요.' })
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return sendJson(res, 503, { error: 'supabase_env_missing' })

  let body
  try {
    body = await readBody(req)
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' })
  }

  const familyId = String(body.familyId || '')
  if (!/^[0-9a-fA-F-]{36}$/.test(familyId)) return sendJson(res, 400, { error: 'family_id_required' })

  const senderName = String(body.senderName || '가족').slice(0, 40)
  const excludeMemberId = body.excludeMemberId || null

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  // 구독 목록은 RLS 그대로 읽는다 — 서비스 롤 키를 서버에 두면 이 함수가 뚫렸을 때
  // 데이터베이스 전체가 열린다. x-family-id만으로 자기 가족 범위에서 읽으면 충분하다.
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-family-id': familyId,
    },
  })
  if (!listRes.ok) return sendJson(res, 502, { error: 'subscription_lookup_failed' })
  const subs = await listRes.json()

  // 보낸 사람 기기에까지 알림이 뜨면, 내가 쓴 말을 내가 알림으로 받는다
  const targets = subs.filter((s) => s.member_id !== excludeMemberId)

  const payload = JSON.stringify({
    title: '우리 가족 톡',
    body: `${senderName}님의 새로운 메시지가 있습니다`,
    tag: 'kinship-chat',
    url: '/family-room',
  })

  let sent = 0
  const expired = []
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        sent += 1
      } catch (err) {
        // 404/410은 그 기기가 구독을 버린 것이다. 남겨두면 보낼 때마다 실패한다.
        if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(s.endpoint)
      }
    })
  )

  if (expired.length) {
    await Promise.all(
      expired.map((endpoint) =>
        fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'x-family-id': familyId,
          },
        })
      )
    )
  }

  return sendJson(res, 200, { sent, removed: expired.length })
}
