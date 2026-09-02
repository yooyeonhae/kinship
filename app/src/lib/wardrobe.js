// 표준 카테고리 (대분류)
export const WARDROBE_CATEGORIES = [
  { id: '상의', label: '상의', emoji: '👕' },
  { id: '하의', label: '하의', emoji: '👖' },
  { id: '아우터', label: '아우터', emoji: '🧥' },
  { id: '원피스', label: '원피스/치마', emoji: '👗' },
  { id: '교복/체육복', label: '교복/체육복', emoji: '🏃' },
  { id: '기타', label: '기타', emoji: '🧢' },
]

// 표준 세부 의류 종류 목록 (사용자가 바로 누를 수 있는 칩)
export const CLOTHING_TYPES_BY_CATEGORY = {
  상의: [
    { label: '반팔', emoji: '👕' },
    { label: '긴팔', emoji: '👔' },
    { label: '민소매', emoji: '🎽' },
    { label: '셔츠/블라우스', emoji: '👔' },
    { label: '맨투맨/후드', emoji: '👕' },
  ],
  하의: [
    { label: '바지', emoji: '👖' },
    { label: '반바지', emoji: '🩳' },
    { label: '청바지', emoji: '👖' },
    { label: '치마', emoji: '👗' },
    { label: '레깅스', emoji: '🩳' },
  ],
  아우터: [
    { label: '점퍼', emoji: '🧥' },
    { label: '바람막이', emoji: '🧥' },
    { label: '가디건', emoji: '🧶' },
    { label: '코트', emoji: '🧥' },
    { label: '패딩', emoji: '❄️' },
    { label: '조끼', emoji: '🦺' },
  ],
  원피스: [
    { label: '원피스', emoji: '👗' },
    { label: '멜빵/점프수트', emoji: '👗' },
    { label: '치마', emoji: '👗' },
  ],
  '교복/체육복': [
    { label: '체육복', emoji: '🏃' },
    { label: '교복', emoji: '🎒' },
    { label: '유니폼', emoji: '🎽' },
    { label: '도복/운동복', emoji: '🥋' },
  ],
  기타: [
    { label: '모자', emoji: '🧢' },
    { label: '우비', emoji: '🌂' },
    { label: '수영복', emoji: '🩱' },
    { label: '한복', emoji: '🎎' },
    { label: '직접입력', emoji: '✏️' },
  ],
}

// 전체 평탄화된 빠른 선택 칩
export const ALL_QUICK_CLOTHING_TYPES = [
  '반팔',
  '긴팔',
  '체육복',
  '치마',
  '원피스',
  '점퍼',
  '바람막이',
  '가디건',
  '코트',
  '교복',
  '바지',
  '반바지',
  '패딩',
  '유니폼',
]

/**
 * Canvas API를 이용해 이미지를 브라우저에서 리사이즈 및 WebP로 압축
 * AI 분석용 Base64 문자열과 업로드용 Blob을 동시에 생성
 */
export async function compressImageToWebP(file, maxPx = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      const base64 = canvas.toDataURL('image/webp', quality)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('이미지 압축에 실패했습니다.'))
            return
          }
          resolve({ blob, base64, width: w, height: h })
        },
        'image/webp',
        quality
      )
    }
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    img.src = url
  })
}

/**
 * 백엔드 Gemini Vision API로 이미지 자동 분류 요청
 */
export async function classifyOutfitWithAI({ imageBase64, imageUrl }) {
  try {
    const res = await fetch('/api/classify-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageUrl, mimeType: 'image/webp' }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      console.warn('AI 분류 호출 실패:', data.error)
      return {
        category: '상의',
        clothingType: '반팔',
        confidence: 0,
        description: '',
        error: data.error,
        fallback: true,
      }
    }

    return data
  } catch (err) {
    console.warn('AI 분류 네트워크 오류:', err)
    return {
      category: '상의',
      clothingType: '반팔',
      confidence: 0,
      description: '',
      error: err.message,
      fallback: true,
    }
  }
}

const BUCKET = 'wardrobe'

/**
 * 아이의 옷장 아이템 목록 조회
 */
export async function fetchWardrobeItems(supabase, familyId, memberId) {
  if (!familyId || !memberId) return []

  // 1. wardrobe_items DB 테이블 조회 시도
  const { data: dbData, error: dbError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('family_id', familyId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (!dbError && dbData) {
    return dbData
  }

  // 2. 테이블이 없거나 에러 시 Storage 버킷에서 직접 목록 조회 (Fallback)
  const prefix = `${familyId}/${memberId}/`
  const { data: storageData, error: storageError } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })

  if (storageError || !storageData) return []

  return storageData
    .filter((f) => f.name && !f.name.endsWith('/'))
    .map((f) => {
      const { data: ud } = supabase.storage.from(BUCKET).getPublicUrl(`${prefix}${f.name}`)
      return {
        id: f.id || f.name,
        storage_path: `${prefix}${f.name}`,
        public_url: ud.publicUrl,
        category: '기타',
        clothing_type: '미분류',
        custom_name: '',
        created_at: f.created_at,
      }
    })
}

/**
 * 옷장 아이템 저장 (Storage 업로드 + DB 메타데이터 저장)
 */
export async function saveWardrobeItem(supabase, itemData) {
  const { familyId, memberId, blob, category, clothingType, customName, aiConfidence, aiLabel } = itemData

  const prefix = `${familyId}/${memberId}/`
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`
  const storagePath = `${prefix}${fileName}`

  // 1. Storage 업로드
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    throw new Error(`스토리지 업로드 실패: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  // 2. DB 테이블 저장 시도
  const row = {
    family_id: familyId,
    member_id: memberId,
    storage_path: storagePath,
    public_url: publicUrl,
    category: category || '기타',
    clothing_type: clothingType || '기타',
    custom_name: customName || '',
    ai_confidence: aiConfidence || null,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('wardrobe_items')
    .insert(row)
    .select()
    .maybeSingle()

  if (insertError) {
    console.warn('wardrobe_items DB 저장 실패(테이블 미생성 가능성):', insertError.message)
    return { ...row, id: fileName }
  }

  return inserted || { ...row, id: fileName }
}

/**
 * 옷장 아이템 삭제
 */
export async function deleteWardrobeItem(supabase, item) {
  // Storage 삭제
  if (item.storage_path) {
    await supabase.storage.from(BUCKET).remove([item.storage_path])
  }

  // DB 행 삭제
  if (item.id && typeof item.id === 'string' && item.id.includes('-')) {
    await supabase.from('wardrobe_items').delete().eq('id', item.id)
  }
}
