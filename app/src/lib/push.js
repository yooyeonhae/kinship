// 휴대폰 알림창에 뜨는 웹 푸시. 서비스 워커가 필요한 이유는 public/sw.js 주석 참고.

const SW_PATH = '/sw.js'

export function pushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

// 서버가 준 base64url 공개키를 PushManager가 받는 바이트 배열로 바꾼다.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getPublicKey() {
  const res = await fetch('/api/push')
  if (!res.ok) return null
  const body = await res.json()
  return body.enabled ? body.publicKey : null
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function enablePush(supabase, { familyId, memberId }) {
  if (!pushSupported()) return { ok: false, error: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: permission }

  const publicKey = await getPublicKey()
  if (!publicKey) return { ok: false, error: 'no_key' }

  const reg = await navigator.serviceWorker.register(SW_PATH)
  // 등록 직후에는 아직 활성 워커가 없을 수 있어 구독이 실패한다
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = sub.toJSON()
  // endpoint가 unique라, 같은 기기가 다시 켜도 행이 쌓이지 않고 갱신된다
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      family_id: familyId,
      member_id: memberId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return { ok: false, error: 'save_failed', detail: error }
  return { ok: true }
}

export async function disablePush(supabase) {
  const sub = await currentSubscription()
  if (!sub) return { ok: true }
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return { ok: true }
}

// 메시지를 보낸 뒤 가족의 다른 기기를 깨운다. 실패해도 채팅 자체는 이미 저장됐으므로
// 화면을 막지 않는다 — 알림이 안 온 것과 말이 안 간 것은 다른 문제다.
export async function notifyFamily({ familyId, senderName, excludeMemberId }) {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ familyId, senderName, excludeMemberId }),
    })
  } catch {
    // 무시
  }
}
