// 웹 푸시를 받는 서비스 워커.
//
// 왜 서비스 워커가 필요한가 — 페이지에서 직접 만드는 new Notification()은 안드로이드
// 크롬에서 아예 지원되지 않고, 무엇보다 앱을 닫으면 코드가 돌지 않는다. 휴대폰
// 알림창에 뜨게 하려면 브라우저가 대신 깨워주는 이 파일이 있어야 한다.
//
// public/에 두는 이유: 서비스 워커는 자기 위치보다 아래 경로만 관리할 수 있어서,
// 앱 전체를 담당하려면 최상위(/sw.js)에서 서빙돼야 한다. Vercel의 SPA rewrite는
// 실제 파일이 있으면 건너뛰므로 이 파일은 index.html로 덮이지 않는다.

self.addEventListener('install', () => {
  // 기다리지 않고 바로 새 버전으로 넘어간다. 알림 문구를 고쳤는데 예전 워커가
  // 계속 살아 있으면 왜 안 바뀌는지 알기 어렵다.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || '우리가족 올인원'
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    // 같은 대화의 알림은 쌓이지 않고 최신 것으로 바뀐다
    tag: payload.tag || 'kinship',
    renotify: true,
    data: { url: payload.url || '/family-room' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/family-room'

  // 이미 열려 있는 탭이 있으면 새로 띄우지 않고 그 탭을 앞으로 가져온다.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
