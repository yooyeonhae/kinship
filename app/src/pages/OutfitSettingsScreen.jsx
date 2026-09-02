import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import WardrobeItemModal from '../components/WardrobeItemModal'
import {
  compressImageToWebP,
  classifyOutfitWithAI,
  fetchWardrobeItems,
  saveWardrobeItem,
  deleteWardrobeItem,
} from '../lib/wardrobe'

// ── 요일 목록 ──
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

// ── 옷 종류 빠른 선택 칩 (요청된 모든 핵심 종류 포함) ──
const OUTFIT_TYPES = [
  { value: '체육복', emoji: '🏃' },
  { value: '반팔', emoji: '👕' },
  { value: '긴팔', emoji: '👔' },
  { value: '바지', emoji: '👖' },
  { value: '반바지', emoji: '🩳' },
  { value: '치마', emoji: '👗' },
  { value: '원피스', emoji: '👗' },
  { value: '점퍼', emoji: '🧥' },
  { value: '바람막이', emoji: '🧥' },
  { value: '가디건', emoji: '🧶' },
  { value: '코트', emoji: '🧥' },
  { value: '패딩', emoji: '❄️' },
  { value: '교복', emoji: '🎒' },
  { value: '유니폼', emoji: '🎽' },
]

// ── 옷 사진 추가/관리 컴포넌트 ──
function WardrobePanel({ child, supabase, familyId, onPickForDraft }) {
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadItems = useCallback(async () => {
    if (!familyId || !child?.member_id) return
    setLoadingItems(true)
    try {
      const list = await fetchWardrobeItems(supabase, familyId, child.member_id)
      setItems(list)
    } catch (err) {
      setError('옷장 사진을 불러오지 못했어요.')
    } finally {
      setLoadingItems(false)
    }
  }, [supabase, familyId, child?.member_id])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // 사진 선택 시 압축 및 AI 분석 모달 오픈
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    try {
      // 1. 브라우저 Canvas로 고품질 WebP 압축 및 Base64 추출 (Squoosh 방식)
      const compressed = await compressImageToWebP(file, 800, 0.8)
      setPreviewData(compressed)
      setModalOpen(true)
      setIsAnalyzing(true)
      setAiResult(null)

      // 2. Gemini Vision AI로 의류 자동 분류 요청
      const aiResponse = await classifyOutfitWithAI({
        imageBase64: compressed.base64,
      })
      setAiResult(aiResponse)
    } catch (err) {
      setError(`사진 처리 실패: ${err.message || '다시 시도해주세요.'}`)
      setModalOpen(false)
    } finally {
      setIsAnalyzing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // 모달에서 확인 시 DB/Storage에 저장
  async function handleConfirmSave(metadata) {
    if (!previewData?.blob) return
    setSaving(true)
    setError('')

    try {
      await saveWardrobeItem(supabase, {
        familyId,
        memberId: child.member_id,
        blob: previewData.blob,
        category: metadata.category,
        clothingType: metadata.clothingType,
        customName: metadata.customName,
        aiConfidence: metadata.aiConfidence,
        aiLabel: metadata.aiLabel,
      })

      setModalOpen(false)
      setPreviewData(null)
      setAiResult(null)
      await loadItems()
    } catch (err) {
      setError(`저장 실패: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm('이 옷 사진을 삭제할까요?')) return
    try {
      await deleteWardrobeItem(supabase, item)
      setItems((prev) => prev.filter((i) => i.id !== item.id && i.storage_path !== item.storage_path))
    } catch (err) {
      setError('삭제하지 못했어요.')
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-display font-bold text-[14px] text-foreground flex items-center gap-1.5">
          <span aria-hidden="true">👗</span> {child.name}의 옷장 ({items.length}벌)
        </p>
        <span className="text-[11px] text-foreground-muted">
          사진을 누르면 요일 지정복에 쏙!
        </span>
      </div>

      {error && <p className="text-[12px] text-destructive mb-2">{error}</p>}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {/* 사진 촬영/추가 버튼 */}
        <label
          className={`aspect-square rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all duration-150 hover:bg-primary/10 shadow-xs`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileSelect}
          />
          <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs">
            <i className="ph-bold ph-camera-plus text-lg"></i>
          </div>
          <span className="text-[12px] font-display font-bold text-primary">옷 촬영/추가</span>
          <span className="text-[10px] text-foreground-muted">AI 자동분류</span>
        </label>

        {/* 등록된 옷 사진 목록 */}
        {items.map((item) => {
          const typeLabel = item.clothing_type || item.category || '옷'
          return (
            <div
              key={item.id || item.storage_path}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-foreground bg-surface shadow-soft group flex flex-col justify-end"
            >
              {/* 이미지 */}
              <img
                src={item.public_url}
                alt={typeLabel}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />

              {/* 그라데이션 오버레이 & 라벨 */}
              <button
                type="button"
                onClick={() => onPickForDraft && onPickForDraft(typeLabel)}
                className="relative z-10 w-full bg-linear-to-t from-black/80 via-black/40 to-transparent pt-4 pb-1.5 px-1.5 text-left active:opacity-80 transition"
                title={`${typeLabel} 선택하기`}
              >
                <p className="font-display font-bold text-[11px] text-white truncate leading-tight flex items-center gap-1">
                  <span>{typeLabel}</span>
                </p>
                {item.custom_name && item.custom_name !== typeLabel && (
                  <p className="text-[9px] text-white/80 truncate">{item.custom_name}</p>
                )}
              </button>

              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(item)
                }}
                className="absolute top-1 right-1 z-20 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition hover:bg-destructive"
                aria-label="사진 삭제"
              >
                <i className="ph-bold ph-trash text-[11px]"></i>
              </button>
            </div>
          )
        })}
      </div>

      {loadingItems && items.length === 0 && (
        <p className="text-[12px] text-foreground-muted py-3 text-center">옷장을 불러오는 중...</p>
      )}

      {/* AI 확인 및 수정 모달 */}
      <WardrobeItemModal
        isOpen={modalOpen}
        onClose={() => {
          if (!saving) {
            setModalOpen(false)
            setPreviewData(null)
          }
        }}
        previewData={previewData}
        aiResult={aiResult}
        isAnalyzing={isAnalyzing}
        onConfirm={handleConfirmSave}
        saving={saving}
      />
    </div>
  )
}

// ── 요일별 지정복 편집 컴포넌트 ──
function ChildOutfitEditor({ child, rules, onSaved, supabase, familyId }) {
  const loadedDraft = DAYS.reduce((acc, d) => {
    acc[d] = rules[d]?.outfit_type || ''
    return acc
  }, {})

  const [draft, setDraft] = useState(loadedDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showWardrobe, setShowWardrobe] = useState(true) // 기본으로 펼쳐둠
  const [activeDay, setActiveDay] = useState('월')

  useEffect(() => {
    setDraft(DAYS.reduce((acc, d) => { acc[d] = rules[d]?.outfit_type || ''; return acc }, {}))
  }, [JSON.stringify(rules)])

  const dirty = DAYS.some((day) => (draft[day] || '').trim() !== (rules[day]?.outfit_type || ''))

  function update(day, value) {
    setDraft((prev) => ({ ...prev, [day]: value }))
  }

  // 옷장 사진이나 빠른 선택 칩을 눌렀을 때 지정복에 넣기
  function handlePickValue(val) {
    if (!val) return
    if (activeDay && DAYS.includes(activeDay)) {
      update(activeDay, val)
    } else {
      const emptyDay = DAYS.find((d) => !(draft[d] || '').trim()) || '월'
      update(emptyDay, val)
      setActiveDay(emptyDay)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const upserts = []
    const deleteIds = []
    for (const day of DAYS) {
      const value = (draft[day] || '').trim()
      const existing = rules[day]
      if (value) {
        upserts.push({ member_id: child.member_id, day_of_week: day, outfit_type: value })
      } else if (existing) {
        deleteIds.push(existing.id)
      }
    }
    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('weekly_outfit_rules')
        .upsert(upserts, { onConflict: 'member_id,day_of_week' })
      if (upsertError) { setSaving(false); setError('저장하지 못했어요.'); return }
    }
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase.from('weekly_outfit_rules').delete().in('id', deleteIds)
      if (deleteError) { setSaving(false); setError('일부 항목을 지우지 못했어요.'); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-surface border-2 border-foreground rounded-xl shadow-sticker p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">👦</span>
          <p className="font-display font-extrabold text-[17px]">{child.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowWardrobe((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-display font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full active:scale-95 transition duration-150"
        >
          <i className={`ph-bold ${showWardrobe ? 'ph-caret-up' : 'ph-caret-down'} text-xs`}></i>
          {showWardrobe ? '옷장 닫기' : '📸 AI 옷장 열기'}
        </button>
      </div>

      {/* 사진 옷장 (AI 자동분류 & 옷 등록) */}
      {showWardrobe && (
        <div className="border-t border-border pt-3 mb-4">
          <WardrobePanel
            child={child}
            supabase={supabase}
            familyId={familyId}
            onPickForDraft={handlePickValue}
          />
        </div>
      )}

      {/* 요일별 입력 그리드 */}
      <div className="mb-3">
        <p className="text-[12px] font-display font-bold text-foreground-muted mb-2">
          요일별 지정복 입력 (원하는 요일을 누른 후 아래 옷 종류를 선택하세요)
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((day) => {
            const isCurrent = activeDay === day
            return (
              <div
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs'
                    : 'border-border bg-surface-muted hover:bg-surface'
                }`}
              >
                <span className={`text-[12px] font-display font-bold ${isCurrent ? 'text-primary' : 'text-foreground-muted'}`}>
                  {day}
                </span>
                <input
                  type="text"
                  data-day={day}
                  value={draft[day]}
                  onFocus={() => setActiveDay(day)}
                  onChange={(e) => update(day, e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-[12px] font-display font-bold text-center outline-none"
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* 요일별 지정복 빠른 선택 칩 */}
      <div className="mb-4">
        <p className="text-[11px] text-foreground-muted mb-1.5 flex items-center justify-between">
          <span>[{activeDay}요일]에 넣을 옷 빠른 선택:</span>
          <button
            type="button"
            onClick={() => update(activeDay, '')}
            className="text-destructive text-[11px] hover:underline"
          >
            {activeDay}요일 비우기
          </button>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {OUTFIT_TYPES.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-[12px] font-display font-bold active:scale-95 transition duration-150 ${
                draft[activeDay] === o.value
                  ? 'bg-secondary-dark text-on-secondary border-foreground shadow-xs'
                  : 'bg-surface-muted text-foreground border-border hover:bg-surface'
              }`}
              onClick={() => update(activeDay, o.value)}
            >
              <span>{o.emoji}</span>
              <span>{o.value}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[13px] text-destructive mb-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving}
        className="w-full bg-secondary-dark text-on-secondary border-2 border-foreground rounded-lg py-3 font-display font-bold text-[15px] shadow-sticker active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-50"
      >
        {saving ? '저장 중...' : dirty ? '변경사항 저장하기' : '저장됨'}
      </button>
    </div>
  )
}

// ── 메인 화면 ──
function OutfitSettingsScreen() {
  const { supabase, familyId, members, loading: membersLoading } = useFamily()
  const children = members.filter((m) => m.role === 'child')

  const [rulesByMember, setRulesByMember] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const loadRules = useCallback(async () => {
    if (!familyId) return
    setLoading(true)
    setErrorMsg('')
    const { data, error } = await supabase.from('weekly_outfit_rules').select('*')
    if (error) {
      setErrorMsg('지정복 규칙을 불러오지 못했어요.')
      setLoading(false)
      return
    }
    const grouped = {}
    for (const row of data || []) {
      if (!grouped[row.member_id]) grouped[row.member_id] = {}
      grouped[row.member_id][row.day_of_week] = row
    }
    setRulesByMember(grouped)
    setLoading(false)
  }, [supabase, familyId])

  useEffect(() => { loadRules() }, [loadRules])

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/parent-tasks"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
          aria-label="할일 리스트로"
        >
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <span className="font-display font-bold text-[15px] text-foreground-muted">요일별 지정복</span>
        <div className="w-10"></div>
      </div>

      <div className="mb-6">
        <h1 className="font-display font-extrabold text-[24px] leading-[30px]">
          아이 옷장 관리 & 요일별 지정복
        </h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">
          📸 옷 사진을 찍으면 <strong>AI가 상의/하의/겉옷 등을 자동 분류</strong>해줘요.
          <br />
          요일별로 입을 옷을 정해두면 날씨에 맞춰 아이 화면에 똑똑하게 추천돼요!
        </p>
      </div>

      {errorMsg && <p className="text-[13px] text-destructive mb-4">{errorMsg}</p>}

      {membersLoading || loading ? (
        <p className="text-foreground-muted text-center py-4">불러오는 중...</p>
      ) : children.length === 0 ? (
        <p className="text-foreground-muted text-center py-4">등록된 자녀가 없어요.</p>
      ) : (
        children.map((child) => (
          <ChildOutfitEditor
            key={child.member_id}
            child={child}
            rules={rulesByMember[child.member_id] || {}}
            onSaved={loadRules}
            supabase={supabase}
            familyId={familyId}
          />
        ))
      )}
    </>
  )
}

export default OutfitSettingsScreen
