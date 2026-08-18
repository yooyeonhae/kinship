import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

// schema.sql의 day_of_week CHECK 제약과 같은 값. 화면 표시 순서는 월~일.
const DAYS = ['월', '화', '수', '목', '금', '토', '일']

function emptyDraft() {
  return DAYS.reduce((acc, d) => ({ ...acc, [d]: '' }), {})
}

function ChildOutfitEditor({ child, rules, onSaved, supabase }) {
  const loadedDraft = useMemo(() => {
    const d = emptyDraft()
    for (const day of DAYS) {
      d[day] = rules[day]?.outfit_type || ''
    }
    return d
  }, [rules])

  const [draft, setDraft] = useState(loadedDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 다른 화면에서 규칙이 바뀐 뒤 다시 들어왔을 때(또는 저장 후 재조회) 반영한다.
  useEffect(() => {
    setDraft(loadedDraft)
  }, [loadedDraft])

  const dirty = DAYS.some((day) => (draft[day] || '').trim() !== (loadedDraft[day] || ''))

  function update(day, value) {
    setDraft((prev) => ({ ...prev, [day]: value }))
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
      if (upsertError) {
        setSaving(false)
        setError('저장하지 못했어요.')
        return
      }
    }
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase.from('weekly_outfit_rules').delete().in('id', deleteIds)
      if (deleteError) {
        setSaving(false)
        setError('일부 항목을 지우지 못했어요.')
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-surface border border-border rounded-lg shadow-soft p-4 mb-4">
      <p className="font-display font-bold text-[16px] mb-3">{child.name}</p>
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {DAYS.map((day) => (
          <div key={day} className="flex flex-col items-center gap-1">
            <span className="text-[12px] font-display font-bold text-foreground-muted">{day}</span>
            <input
              type="text"
              value={draft[day]}
              onChange={(e) => update(day, e.target.value)}
              placeholder="—"
              className="w-full bg-surface-muted rounded-md px-1 py-2 text-[12px] text-center border border-border outline-none"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-destructive mb-2">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving}
        className="w-full bg-secondary-dark text-on-secondary rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150 disabled:opacity-50"
      >
        {saving ? '저장 중...' : dirty ? '저장하기' : '저장됨'}
      </button>
    </div>
  )
}

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
    // 정책은 가족 범위로 이미 스코프되어 있으므로(members 조인) 필터 없이 전체를 가져온다.
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

  useEffect(() => {
    loadRules()
  }, [loadRules])

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
        <h1 className="font-display font-extrabold text-[24px] leading-[30px]">요일마다 입을 옷을 정해주세요</h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">
          비워두면 그 요일엔 지정복 없이 평소처럼 골라 입어요.
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
          />
        ))
      )}
    </>
  )
}

export default OutfitSettingsScreen
