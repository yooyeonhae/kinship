import { sendJson } from './_serviceKey.js'

// 카테고리별 안전한 3차 Fallback 고화질 이미지
const CATEGORY_FALLBACKS = {
  '찌개/국물류': 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?auto=format&fit=crop&w=800&q=80',
  '고기/구이/볶음류': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
  해산물류: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  '한그릇/면류': 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?auto=format&fit=crop&w=800&q=80',
  '양식/퓨전': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  기본: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80',
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const name = (url.searchParams.get('name') || '').trim()
  const category = (url.searchParams.get('category') || '').trim()

  if (!name) {
    return sendJson(res, 400, { error: '메뉴 이름(name)이 필요합니다.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  // 1. DB 캐시 우선 조회
  if (supabaseUrl && supabaseKey) {
    try {
      const selectRes = await fetch(
        `${supabaseUrl}/rest/v1/menu_items?name=eq.${encodeURIComponent(name)}&select=*`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )
      if (selectRes.ok) {
        const rows = await selectRes.json()
        if (rows && rows.length > 0 && rows[0].image_url) {
          return sendJson(res, 200, {
            name: rows[0].name,
            category: rows[0].category || category,
            imageUrl: rows[0].image_url,
            sourceType: rows[0].source_type || 'LOCAL',
            cached: true,
          })
        }
      }
    } catch (err) {
      console.warn('DB menu_items 캐시 조회 에러:', err.message)
    }
  }

  // 2. 미등록 메뉴 시 search_keyword 생성 (Gemini AI 최적화)
  const geminiKey = process.env.GEMINI_API_KEY
  let searchKeyword = `${name} food dish`
  let inferredCategory = category || '한그릇/면류'

  if (geminiKey) {
    try {
      const geminiPrompt = `
한국 요리 메뉴 "${name}"에 어울리는 스톡 푸드 사진을 찾기 위한 명확하고 구체적인 영문 검색 키워드 1개와 카테고리를 JSON으로 작성해주세요.
[카테고리 목록]: 찌개/국물류, 고기/구이/볶음류, 해산물류, 한그릇/면류, 양식/퓨전
예시:
{"searchKeyword": "Korean spicy chicken stew Dakbokkeumtang", "category": "고기/구이/볶음류"}
`
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
        }
      )
      if (gRes.ok) {
        const gData = await gRes.json()
        const text = gData.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const parsed = JSON.parse(text)
          if (parsed.searchKeyword) searchKeyword = parsed.searchKeyword
          if (parsed.category) inferredCategory = parsed.category
        }
      }
    } catch (err) {
      console.warn('Gemini search_keyword 생성 실패:', err.message)
    }
  }

  // 3. 외부 고화질 음식 이미지 매핑
  const encodedQuery = encodeURIComponent(searchKeyword)
  const imageUrl = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80&query=${encodedQuery}`

  // 4. 검색 결과 DB 자동 업서트 (Upsert)
  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/menu_items`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          name,
          category: inferredCategory,
          search_keyword: searchKeyword,
          image_url: imageUrl,
          source_type: 'EXTERNAL_CACHED',
        }),
      })
    } catch (err) {
      console.warn('DB menu_items 업서트 실패:', err.message)
    }
  }

  // 5. 실패 시 Fallback URL 반환 대비
  const fallbackUrl = CATEGORY_FALLBACKS[inferredCategory] || CATEGORY_FALLBACKS.기본

  return sendJson(res, 200, {
    name,
    category: inferredCategory,
    searchKeyword,
    imageUrl: imageUrl || fallbackUrl,
    sourceType: 'EXTERNAL_CACHED',
    fallbackUrl,
  })
}
