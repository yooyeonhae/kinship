// data.go.kr은 인증키를 Encoding/Decoding 두 벌로 발급한다. 어느 쪽을 .env에 넣었는지
// 알 수 없으므로 '%'가 들어 있으면 이미 인코딩된 것으로 보고 그대로 쓴다.
// 잘못 판단해 두 번 인코딩하면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR로 떨어진다.
export function encodeServiceKey(key) {
  return key.includes('%') ? key : encodeURIComponent(key)
}

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

// 공공데이터포털은 장애 시 XML 에러 문서를 200으로 돌려준다. JSON.parse가 터지기 전에
// 본문을 그대로 실어 올려야 원인(키 미등록/트래픽 초과)을 화면에서 구분할 수 있다.
export async function fetchJson(url) {
  const upstream = await fetch(url)
  const text = await upstream.text()
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, status: upstream.status, body: text.slice(0, 400) }
  }
}
