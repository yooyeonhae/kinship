import { useEffect, useState } from 'react'
import {
  WARDROBE_CATEGORIES,
  CLOTHING_TYPES_BY_CATEGORY,
  ALL_QUICK_CLOTHING_TYPES,
} from '../lib/wardrobe'

export default function WardrobeItemModal({
  isOpen,
  onClose,
  previewData, // { blob, base64 }
  aiResult,    // { category, clothingType, confidence, description, fallback }
  isAnalyzing,
  onConfirm,
  saving,
}) {
  const [selectedCategory, setSelectedCategory] = useState('상의')
  const [selectedType, setSelectedType] = useState('반팔')
  const [customName, setCustomName] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  // AI 분석 결과가 도착하면 폼에 자동 반영
  useEffect(() => {
    if (aiResult) {
      if (aiResult.category) {
        setSelectedCategory(aiResult.category)
      }
      if (aiResult.clothingType) {
        setSelectedType(aiResult.clothingType)
        // 표준 목록에 없으면 커스텀 모드 활성화
        if (!ALL_QUICK_CLOTHING_TYPES.includes(aiResult.clothingType)) {
          setIsCustom(true)
          setCustomName(aiResult.clothingType)
        } else {
          setIsCustom(false)
        }
      }
      // 성공한 정상 설명일 때만 customName에 채움 (에러/fallback인 경우 채우지 않음)
      if (aiResult.description && !aiResult.fallback && !aiResult.error && !customName) {
        setCustomName(aiResult.description)
      }
    }
  }, [aiResult])

  if (!isOpen) return null

  const currentTypeOptions = CLOTHING_TYPES_BY_CATEGORY[selectedCategory] || []

  function handleTypeSelect(typeLabel) {
    if (typeLabel === '직접입력') {
      setIsCustom(true)
    } else {
      setSelectedType(typeLabel)
      setIsCustom(false)
    }
  }

  function handleSave() {
    const finalType = isCustom ? (customName.trim() || '기타') : selectedType
    onConfirm({
      category: selectedCategory,
      clothingType: finalType,
      customName: customName.trim(),
      aiConfidence: aiResult?.confidence || null,
      aiLabel: aiResult?.clothingType || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-sticker border-2 border-foreground overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="bg-tape-yellow/30 px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">✨</span>
            <h2 className="font-display font-extrabold text-[18px] text-foreground">
              옷 종류 확인 및 추가
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-muted active:scale-90 transition"
          >
            <i className="ph-bold ph-x text-lg text-foreground-muted"></i>
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 사진 미리보기 & AI 분석 상태 카드 */}
          <div className="flex gap-4 items-start bg-surface-muted rounded-xl p-3.5 border border-border">
            <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-foreground bg-surface shrink-0 shadow-soft">
              {previewData?.base64 && (
                <img
                  src={previewData.base64}
                  alt="선택한 옷 미리보기"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isAnalyzing ? (
                <div className="py-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-primary font-display font-bold text-[14px]">
                    <i className="ph-bold ph-spinner-gap animate-spin text-lg"></i>
                    <span>AI가 옷을 분석하고 있어요...</span>
                  </div>
                  <p className="text-[12px] text-foreground-muted">
                    사진에서 상의, 하의, 겉옷 등을 자동으로 감지합니다.
                  </p>
                </div>
              ) : aiResult && !aiResult.fallback ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-[12px] font-display font-bold">
                    <i className="ph-fill ph-sparkle text-xs"></i>
                    AI 자동인식 ({aiResult.confidence || 90}%)
                  </div>
                  <p className="font-display font-bold text-[15px] text-foreground truncate">
                    {aiResult.category} · {aiResult.clothingType}
                  </p>
                  {aiResult.description && (
                    <p className="text-[12px] text-foreground-muted leading-tight line-clamp-2">
                      {aiResult.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-display font-bold text-[14px] text-foreground">
                    옷의 종류를 선택해주세요
                  </p>
                  <p className="text-[12px] text-foreground-muted">
                    아래 버튼을 눌러 정확한 종류를 지정할 수 있어요.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 1. 대분류 선택 */}
          <div>
            <label className="block font-display font-bold text-[13px] text-foreground-muted mb-2">
              1. 대분류
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {WARDROBE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id)
                    const firstOption = CLOTHING_TYPES_BY_CATEGORY[cat.id]?.[0]?.label
                    if (firstOption) setSelectedType(firstOption)
                  }}
                  className={`py-2 px-2 rounded-lg text-[13px] font-display font-bold flex items-center justify-center gap-1.5 border transition-all duration-150 active:scale-95 ${
                    selectedCategory === cat.id
                      ? 'bg-secondary-dark text-on-secondary border-foreground shadow-xs'
                      : 'bg-surface-muted text-foreground border-border hover:bg-surface'
                  }`}
                >
                  <span aria-hidden="true">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 세부 종류 선택 (빠른 칩) */}
          <div>
            <label className="block font-display font-bold text-[13px] text-foreground-muted mb-2">
              2. 세부 종류 ({selectedCategory})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentTypeOptions.map((item) => {
                const isSelected = !isCustom && selectedType === item.label
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleTypeSelect(item.label)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-display font-bold border flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-on-primary border-foreground shadow-xs'
                        : 'bg-surface-muted text-foreground border-border hover:bg-surface'
                    }`}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-display font-bold border flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                  isCustom
                    ? 'bg-primary text-on-primary border-foreground shadow-xs'
                    : 'bg-surface-muted text-foreground border-border hover:bg-surface'
                }`}
              >
                <span>✏️</span>
                <span>기타/직접입력</span>
              </button>
            </div>
          </div>

          {/* 3. 직접 입력 / 메모 */}
          <div>
            <label className="block font-display font-bold text-[13px] text-foreground-muted mb-1.5">
              {isCustom ? '3. 직접 옷 종류 입력 (필수)' : '3. 옷 이름이나 특징 메모 (선택)'}
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={
                isCustom
                  ? '예: 노란색 우비, 유치원 원복, 태권도복...'
                  : '예: 줄무늬 반팔, 파란 체육복 (선택)'
              }
              maxLength={30}
              className={`w-full bg-surface-muted rounded-lg px-3 py-2.5 text-[14px] border outline-none transition focus:border-foreground ${
                isCustom ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              }`}
            />
          </div>

          {/* 추천 요약 미리보기 */}
          <div className="bg-tape-yellow/20 rounded-lg p-3 border border-border/80 flex items-center justify-between">
            <span className="text-[13px] text-foreground-muted font-display font-bold">
              저장될 분류:
            </span>
            <span className="font-display font-extrabold text-[15px] text-foreground">
              [{selectedCategory}] {isCustom ? (customName || '기타') : selectedType}
            </span>
          </div>
        </div>

        {/* 하단 버튼 바 */}
        <div className="p-4 bg-surface border-t border-border flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-lg border-2 border-border font-display font-bold text-[15px] text-foreground-muted hover:bg-surface-muted active:scale-95 transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isAnalyzing}
            className="flex-2 py-3 rounded-lg bg-secondary-dark text-on-secondary border-2 border-foreground shadow-sticker font-display font-bold text-[15px] flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <i className="ph-bold ph-spinner-gap animate-spin text-lg"></i>
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <i className="ph-bold ph-check text-lg"></i>
                <span>옷장에 추가하기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
