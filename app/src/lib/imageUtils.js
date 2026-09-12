/**
 * 음식 사진 및 사용자 등록 이미지 압축/최적화 유틸리티
 */
export async function compressImage(file, maxPx = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'))
      return
    }

    // 이미지가 아닌 경우 에러
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(JPG, PNG, WebP 등)만 등록할 수 있습니다.'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // 해상도 조절 (최대 900px 유지하여 용량 40~70KB 수준으로 최적화)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('캔버스를 초기화할 수 없습니다.'))
        return
      }

      // 흰색 배경 채우기 (투명 PNG 대비)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)

      // 부드러운 이미지 리샘플링
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // 1. WebP 포맷 시도
      let base64 = canvas.toDataURL('image/webp', quality)
      let mimeType = 'image/webp'

      // Safari 구버전 등 WebP 미지원 시 JPEG로 폴백
      if (!base64.startsWith('data:image/webp')) {
        base64 = canvas.toDataURL('image/jpeg', quality)
        mimeType = 'image/jpeg'
      }

      canvas.toBlob(
        (blob) => {
          resolve({
            blob: blob || file,
            base64,
            width,
            height,
            mimeType,
          })
        },
        mimeType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지를 읽는 도중 오류가 발생했습니다.'))
    }

    img.src = objectUrl
  })
}
