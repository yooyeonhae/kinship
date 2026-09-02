import { sendJson } from './_serviceKey.js'

// 의류 대분류 & 세부 종류 표준 목록
const CLASSIFICATION_PROMPT = `
당신은 아동 및 가족 의류 분류 전문가 AI입니다.
제공된 사진의 의류를 분석하여 다음 기준에 맞춰 JSON으로만 응답해주세요.

[대분류 (category)]
- 상의 (top)
- 하의 (bottom)
- 아우터 (outer)
- 원피스 (dress)
- 교복/체육복 (uniform)
- 기타 (etc)

[세부 종류 (clothingType) - 반드시 이 중 하나를 고르거나 가장 근접한 한국어 단어 사용]
- 반팔
- 긴팔
- 민소매
- 셔츠/블라우스
- 맨투맨/후드
- 바지
- 반바지
- 청바지
- 치마
- 원피스
- 체육복
- 점퍼
- 바람막이
- 가디건
- 코트
- 패딩
- 교복
- 유니폼
- 기타

[응답 JSON 형식 - 마크다운이나 기타 텍스트 없이 오직 순수 JSON만 반환]
{
  "category": "상의",
  "clothingType": "반팔",
  "confidence": 92,
  "description": "파란색 아동용 반팔 티셔츠",
  "suggestedTags": ["상의", "반팔", "여름"]
}
`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'POST 메서드만 지원합니다.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return sendJson(res, 503, {
      error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.',
      fallback: true,
    })
  }

  try {
    // req body 파싱
    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        body = {}
      }
    } else if (!body) {
      body = await new Promise((resolve) => {
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            resolve({})
          }
        })
      })
    }

    const { imageBase64, mimeType = 'image/webp', imageUrl } = body || {}

    let inlineData = null

    if (imageBase64) {
      // data:image/...;base64, 제거
      const cleaned = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
      inlineData = {
        mimeType: mimeType || 'image/webp',
        data: cleaned,
      }
    } else if (imageUrl) {
      // 이미지 URL이 주어지면 직접 다운로드하여 base64로 변환
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) {
        return sendJson(res, 400, { error: '이미지 URL에서 사진을 불러올 수 없습니다.' })
      }
      const buffer = await imgRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const fetchedMime = imgRes.headers.get('content-type') || 'image/jpeg'
      inlineData = {
        mimeType: fetchedMime,
        data: base64,
      }
    } else {
      return sendJson(res, 400, { error: '이미지 데이터(imageBase64 또는 imageUrl)가 필요합니다.' })
    }

    // Gemini API 호출 (gemini-2.5-flash 또는 gemini-1.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: CLASSIFICATION_PROMPT },
            {
              inlineData: inlineData,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }

    let geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })

    // 2.5-flash 실패 시 1.5-flash로 fallback
    if (!geminiRes.ok) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
      geminiRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return sendJson(res, 502, {
        error: `Gemini API 호출 실패: ${geminiRes.statusText}`,
        detail: errText.slice(0, 300),
      })
    }

    const geminiData = await geminiRes.json()
    const textOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let parsed = null
    try {
      parsed = JSON.parse(textOutput)
    } catch {
      // JSON 파싱 실패 시 코드 블록 제거 후 재시도
      const match = textOutput.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      }
    }

    if (!parsed) {
      return sendJson(res, 200, {
        category: '상의',
        clothingType: '반팔',
        confidence: 50,
        description: '자동 인식 결과를 파싱하지 못했습니다.',
        raw: textOutput,
      })
    }

    return sendJson(res, 200, parsed)
  } catch (err) {
    return sendJson(res, 500, {
      error: `서버 오류: ${err.message}`,
    })
  }
}
