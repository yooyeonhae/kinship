import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'
import { MEMBER_BG_CLASS, MEMBER_TEXT_CLASS, colorTokenForMember } from '../lib/memberColors'

function ParentProgressScreen() {
  const { supabase, familyId, members, loading: membersLoading } = useFamily()
  const [todos, setTodos] = useState([])
  const [loadingTodos, setLoadingTodos] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!familyId) return
    // 화면을 벗어난 뒤 도착한 응답은 버린다
    let active = true
    setLoadingTodos(true)
    ;(async () => {
      const { data, error } = await supabase.from('todos').select('*').order('created_at').order('todo_id')
      if (!active) return
      if (error) {
        setErrorMsg('완료 현황을 불러오지 못했어요.')
        setLoadingTodos(false)
        return
      }
      setErrorMsg('')
      setTodos(data || [])
      setLoadingTodos(false)
    })()
    return () => {
      active = false
    }
  }, [supabase, familyId])

  const parents = members.filter((m) => m.role === 'parent')
  const parentStats = parents.map((p) => {
    const mine = todos.filter((t) => t.assignee_member_id === p.member_id)
    const done = mine.filter((t) => t.is_done).length
    return { ...p, done, total: mine.length, token: colorTokenForMember(members, p.member_id) }
  })
  const incomplete = todos.filter((t) => !t.is_done && parents.some((p) => p.member_id === t.assignee_member_id))

  const loading = membersLoading || loadingTodos

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
        <span className="font-display font-bold text-[15px] text-foreground-muted">완료 현황</span>
        <div className="w-10"></div>
      </div>

      <div className="mb-8">
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">
          오늘 우리 둘 다
          <br />
          <span className="bg-tape-yellow px-1 -mx-1 rounded-sm">확인했어요</span>
        </h1>
        <p className="text-foreground-muted text-[15px] leading-[22px] mt-2">한쪽만 하고 다른 쪽은 모르는 일이 없도록, 서로의 진행을 같이 봐요.</p>
      </div>

      {errorMsg && <p className="text-[13px] text-destructive mb-3">{errorMsg}</p>}

      <div className="relative bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-6 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150">
        <span className="absolute -top-2 left-8 w-12 h-5 bg-tape-lime/90 rotate-[-3deg] rounded-sm shadow-sm" aria-hidden="true"></span>

        {loading ? (
          <p className="text-foreground-muted text-[14px] py-4 text-center">불러오는 중...</p>
        ) : parentStats.length === 0 ? (
          <p className="text-foreground-muted text-[14px] py-4 text-center">등록된 부모가 없어요.</p>
        ) : parentStats.length === 2 ? (
          <>
            <div className="relative h-14 mb-4">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-surface-muted rounded-full"></div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <i className="ph-fill ph-target text-lg text-primary"></i>
              </div>
              <div
                className="absolute left-1/2 -top-1 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-secondary ring-2 ring-surface flex items-center justify-center rotate-[-10deg]"
                style={{ boxShadow: '0 0 10px rgba(46,125,50,0.55)' }}
                aria-hidden="true"
              >
                <i className="ph-bold ph-check text-on-secondary text-sm"></i>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]" style={{ left: '29%' }}>
                <div className={`w-11 h-11 rounded-full ${MEMBER_BG_CLASS[parentStats[0].token]} ring-4 ring-surface flex items-center justify-center -translate-x-1/2 shadow-soft`}>
                  <span className="font-display font-bold text-on-primary text-[13px]">{parentStats[0].name}</span>
                </div>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]" style={{ right: '29%' }}>
                <div className={`w-11 h-11 rounded-full ${MEMBER_BG_CLASS[parentStats[1].token]} ring-4 ring-surface flex items-center justify-center translate-x-1/2 shadow-soft`}>
                  <span className="font-display font-bold text-on-primary text-[13px]">{parentStats[1].name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[15px]">
              <span className={`font-display font-bold ${MEMBER_TEXT_CLASS[parentStats[0].token]}`}>
                {parentStats[0].name} · {parentStats[0].done}/{parentStats[0].total} 완료
              </span>
              <span className={`font-display font-bold ${MEMBER_TEXT_CLASS[parentStats[1].token]}`}>
                {parentStats[1].name} · {parentStats[1].done}/{parentStats[1].total} 완료
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {parentStats.map((p) => (
              <span key={p.member_id} className={`inline-flex items-center rounded-full px-3 py-1.5 text-[14px] font-display font-bold text-white ${MEMBER_BG_CLASS[p.token]}`}>
                {p.name} · {p.done}/{p.total} 완료
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="font-display font-bold text-[13px] tracking-wide text-foreground-muted mb-3">아직 안 끝난 일</p>
      <div className="flex flex-col gap-3">
        {loading ? null : incomplete.length === 0 ? (
          <p className="text-foreground-muted text-[14px] py-2">모두 끝냈어요!</p>
        ) : (
          incomplete.map((t) => {
            const member = members.find((m) => m.member_id === t.assignee_member_id)
            const token = colorTokenForMember(members, t.assignee_member_id)
            return (
              <div key={t.todo_id} className="bg-surface border-2 border-accent rounded-lg shadow-soft px-4 py-4 flex items-center gap-3">
                <i className="ph-fill ph-warning-circle text-2xl text-accent shrink-0"></i>
                <div className="flex-1">
                  <p className="font-display font-bold text-[16px]">{t.title}</p>
                  <p className="text-[13px] text-foreground-muted mt-0.5">{member?.name || '담당자 미정'} 담당 · 아직 미완료</p>
                </div>
                <span className={`w-8 h-8 rounded-full ${MEMBER_BG_CLASS[token]} ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary`}>
                  {member?.name?.charAt(0) || '?'}
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className="flex-1"></div>
      <div className="flex items-center justify-center gap-2 mb-1" aria-hidden="true">
        <i className="ph-duotone ph-coffee text-xl text-member-4 rotate-[-6deg]"></i>
        <span className="font-doodle text-[14px] text-foreground-muted">오늘도 고생했어요</span>
      </div>
    </>
  )
}

export default ParentProgressScreen
