import { useCallback, useEffect, useRef, useState } from 'react'
import { useFamily } from '../context/FamilyContext'

const LOG_KEY = 'kinship_chat_log_v1'

// schema.sql의 day_of_week CHECK 제약과 같은 값. 인덱스는 Date#getDay()에 맞춘다.
const DAY_KEYS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_ALIAS = {
  월요일: '월',
  화요일: '화',
  수요일: '수',
  목요일: '목',
  금요일: '금',
  토요일: '토',
  일요일: '일',
}

function pad(n) {
  return (n < 10 ? '0' : '') + n
}

function extractAllTimes(text) {
  const re = /(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?\s*분?/g
  const out = []
  let m
  while ((m = re.exec(text))) {
    const ampm = m[1]
    let h = parseInt(m[2], 10)
    const min = m[3] ? parseInt(m[3], 10) : 0
    if ((ampm === '오후' || ampm === '저녁' || ampm === '밤') && h < 12) h += 12
    if ((ampm === '오전' || ampm === '아침') && h === 12) h = 0
    if (h > 23 || min > 59) continue
    out.push(pad(h) + ':' + pad(min))
  }
  return out
}

function extractQuoted(text) {
  const m = text.match(/['"“”‘’]([^'"“”‘’]{1,80})['"“”‘’]/)
  return m ? m[1].trim() : null
}

function detect(text) {
  let domain = 'todo'
  if (/냉장고|재료|레시피|반찬|저녁\s*메뉴/.test(text)) domain = 'fridge'
  else if (/옷차림|지정복|체육복|입지|입어야|뭐\s*입/.test(text)) domain = 'outfit'
  else if (/주말|축제|나들이|볼거리|가볼\s*만/.test(text)) domain = 'weekend'
  else if (/헤드라인|뉴스|소식|날씨/.test(text)) domain = 'info'
  else if (/구성원|가족\s*코드|사용법|어떻게\s*써|도움말/.test(text)) domain = 'help'

  let intent = 'add'
  if (/삭제|지워|빼줘|빼\s*주세요|없애|취소해/.test(text)) intent = 'delete'
  else if (/완료|다\s*했|끝냈|체크/.test(text)) intent = 'complete'
  else if (/뭐.*있|뭐지|뭐야|알려줘|언제|몇\s*시|있나요|있어\?|\?$/.test(text)) intent = 'query'

  return { domain, intent, times: extractAllTimes(text) }
}

const GO_VERBS = [/가야\s*(한다|된다|돼|해)/, /가야지/, /가기로\s*했다/, /간다/]
const OTHER_VERBS = [
  /해야\s*(한다|된다|돼|해)/,
  /해야지/,
  /하기로\s*했다/,
  /할\s*거야/,
  /할거야/,
  /사야\s*(한다|된다|돼|해)/,
  /사야지/,
]

function buildTodoTitle(text) {
  let t = text
  t = t.replace(/오늘|내일|모레|이번\s*주|다음\s*주/g, '')
  t = t.replace(/(오전|오후|아침|저녁|밤)?\s*\d{1,2}\s*(?::|시)\s*\d{0,2}\s*분?/g, '')
  t = t.replace(/할일(로)?\s*/g, '')
  t = t.replace(/(추가해줘|추가해|추가|등록해줘|등록해|등록)/g, '')
  let goMatched = false
  for (const re of GO_VERBS) {
    if (re.test(t)) {
      goMatched = true
      t = t.replace(re, '')
    }
  }
  for (const re of OTHER_VERBS) t = t.replace(re, '')
  t = t.replace(/[.,!?？]+\s*$/g, '').trim()
  if (!t) t = '할일'
  if (goMatched && !t.includes('가기')) t += ' 가기'
  return t
}

function findDay(text) {
  for (const [long, short] of Object.entries(DAY_ALIAS)) {
    if (text.includes(long)) return short
  }
  return null
}

function ChatBot() {
  const { supabase, familyId, members, currentMember, isParentAuthed } = useFamily()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState(() => {
    try {
      const raw = sessionStorage.getItem(LOG_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch {
      // 기록이 깨졌으면 인사말부터 다시 시작하면 된다
    }
    return [
      {
        role: 'bot',
        text: '안녕하세요! 오늘 할일과 요일별 지정복을 물어보거나, 자연어로 할일을 추가·완료·삭제할 수 있어요. 예) "오늘 18시 도서관 가야 된다"',
      },
    ]
  })
  const logRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-40)))
    } catch {
      // 저장 실패가 대화 자체를 막을 이유는 없다
    }
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const findMember = useCallback(
    (text) => members.find((m) => m.name && text.includes(m.name)) || null,
    [members]
  )

  // 챗봇이 쓴 내용을 지금 열려 있는 화면이 모르면 "추가했다는데 안 보인다"가 된다
  const notifyChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kinship:change'))
  }, [])

  const handleTodo = useCallback(
    async (text, intent, times) => {
      const target = findMember(text)

      if (intent === 'query') {
        let q = supabase.from('todos').select('*').order('created_at')
        if (target) q = q.eq('assignee_member_id', target.member_id)
        const { data, error } = await q
        if (error) return '할일을 불러오지 못했어요.'
        if (!data.length) return `${target ? target.name + '의' : '가족'} 할일이 아직 없어요.`
        return (
          (target ? target.name + '의 ' : '오늘 ') +
          '할일: ' +
          data.map((t) => t.title + (t.is_done ? ' [완료]' : '')).join(', ')
        )
      }

      if (intent === 'complete') {
        const key = extractQuoted(text) || buildTodoTitle(text)
        const { data, error } = await supabase.from('todos').select('*').eq('is_done', false)
        if (error) return '할일을 불러오지 못했어요.'
        const hit = data.find((t) => t.title.includes(key) || key.includes(t.title))
        if (!hit) return '완료 처리할 할일을 찾지 못했어요.'
        // 완료자는 서버가 정한다(toggle_my_todo). 자기 담당이 아니면 서버가 거절한다.
        const { data: res, error: rpcError } = await supabase.rpc('toggle_my_todo', {
          p_todo_id: hit.todo_id,
        })
        if (rpcError || res?.ok === false) return '내가 담당인 할일만 완료로 바꿀 수 있어요.'
        notifyChange()
        return `"${hit.title}" 할일을 완료했어요.`
      }

      if (intent === 'delete') {
        if (!isParentAuthed) return '할일 삭제는 부모만 할 수 있어요. 홈에서 부모로 전환한 뒤 PIN을 입력해주세요.'
        const key = extractQuoted(text) || buildTodoTitle(text)
        const { data, error } = await supabase.from('todos').select('*')
        if (error) return '할일을 불러오지 못했어요.'
        const hit = data.find((t) => t.title.includes(key) || key.includes(t.title))
        if (!hit) return '해당하는 할일을 찾지 못했어요.'
        const { error: delError } = await supabase.from('todos').delete().eq('todo_id', hit.todo_id)
        if (delError) return '할일을 삭제하지 못했어요.'
        notifyChange()
        return `"${hit.title}" 할일을 삭제했어요.`
      }

      if (!isParentAuthed) return '할일 등록은 부모만 할 수 있어요. 홈에서 부모로 전환한 뒤 PIN을 입력해주세요.'
      const time = times[0] || null
      const title = extractQuoted(text) || buildTodoTitle(text)
      const fullTitle = time ? `${time} ${title}` : title
      const { error } = await supabase
        .from('todos')
        .insert({ family_id: familyId, title: fullTitle, assignee_member_id: target?.member_id || null })
      if (error) return '할일을 추가하지 못했어요.'
      notifyChange()
      return `"${fullTitle}" 할일을 ${target ? target.name + ' 담당으로 ' : ''}추가했어요.`
    },
    [supabase, familyId, findMember, isParentAuthed, notifyChange]
  )

  const handleOutfit = useCallback(
    async (text) => {
      const children = members.filter((m) => m.role === 'child')
      if (!children.length) return '등록된 자녀가 없어요.'
      const named = findMember(text)
      const target = named || (currentMember?.role === 'child' ? currentMember : children[0])
      const day = findDay(text) || DAY_KEYS[new Date().getDay()]
      const dayLabel = findDay(text) ? `${day}요일` : '오늘'

      const { data, error } = await supabase
        .from('weekly_outfit_rules')
        .select('*')
        .eq('member_id', target.member_id)
        .eq('day_of_week', day)
      if (error) return '옷차림 정보를 불러오지 못했어요.'
      if (!data.length) return `${target.name}의 ${dayLabel} 지정복은 아직 등록되어 있지 않아요.`
      return `${target.name}의 ${dayLabel} 지정복은 "${data[0].outfit_type}"이에요.`
    },
    [supabase, members, currentMember, findMember]
  )

  const respond = useCallback(
    async (text) => {
      const { domain, intent, times } = detect(text)
      if (domain === 'outfit') return handleOutfit(text)
      if (domain === 'fridge') return '냉장고 재료와 레시피는 아직 저장되지 않아요. "할일" 탭에서 확인해주세요.'
      if (domain === 'weekend') return '주말 나들이는 "주말" 탭에서 지역별 축제·명소를 실시간으로 보여드려요.'
      if (domain === 'info') return '날씨와 소식은 "정보" 탭과 자녀 옷차림 화면에서 확인할 수 있어요.'
      if (domain === 'help')
        return '탭 안내 — 🏠 홈: 사용할 구성원 선택 / ✅ 할일: 가족 할일 등록·완료 / 📰 정보: 뉴스·생활정보 / 🎈 주말: 축제·나들이 / ⛺ 아지트: 가족 채팅과 게임'
      return handleTodo(text, intent, times)
    },
    [handleTodo, handleOutfit]
  )

  async function submit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setLog((prev) => [...prev, { role: 'user', text }])
    setBusy(true)
    let reply
    try {
      reply = await respond(text)
    } catch {
      reply = '죄송해요, 이 문장은 이해하지 못했어요. 다른 방식으로 말씀해주시겠어요?'
    }
    setBusy(false)
    setLog((prev) => [...prev, { role: 'bot', text: reply }])
  }

  if (!familyId) return null

  return (
    <>
      {/* 파란 원 + 아이콘은 어느 앱에나 있는 모양이라 이 앱의 콜라주 언어와 겉돌았다.
          오려 붙인 말풍선 스티커로 바꾼다 — 워시테이프 옐로우 + 하드 보더/그림자 + 손글씨. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="가족 챗봇 열기"
          className="fixed z-40 bottom-20 right-5 active:scale-95 transition duration-150"
        >
          <span className="relative inline-block -rotate-3">
            {/* 꼬리를 먼저 깔고 말풍선이 그 위를 덮어 이음매를 가린다 */}
            <span
              className="absolute right-5 -bottom-1.5 w-3.5 h-3.5 bg-tape-yellow border-2 border-foreground rotate-45"
              aria-hidden="true"
            ></span>
            <span className="relative block bg-tape-yellow text-foreground border-2 border-foreground rounded-md shadow-sticker px-3.5 py-2.5">
              <span className="font-doodle font-bold text-[17px] leading-none block whitespace-nowrap">
                챗봇
              </span>
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div
            className="max-w-md mx-auto bg-surface border-x-2 border-t-2 border-foreground rounded-t-lg shadow-soft flex flex-col overflow-hidden"
            style={{ height: 'min(70vh, 560px)' }}
          >
            {/* 스크랩북 상단에 붙인 워시테이프 */}
            <div className="flex shrink-0" aria-hidden="true">
              <span className="h-1.5 flex-1 bg-tape-blue"></span>
              <span className="h-1.5 flex-1 bg-tape-yellow"></span>
              <span className="h-1.5 flex-1 bg-tape-pink"></span>
              <span className="h-1.5 flex-1 bg-tape-lime"></span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="font-display font-bold text-[16px] bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">
                우리집 도우미
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="챗봇 닫기"
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition duration-150"
              >
                <i className="ph-bold ph-x text-lg text-foreground-muted"></i>
              </button>
            </div>

            <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {log.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[15px] leading-[22px] font-body ${
                    m.role === 'user'
                      ? 'self-end bg-primary text-on-primary'
                      : 'self-start bg-surface-muted text-foreground'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && <div className="self-start text-[13px] text-foreground-muted px-1">생각하는 중…</div>}
            </div>

            <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 오늘 18시 도서관 가야 된다"
                className="flex-1 min-w-0 bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border outline-none focus:border-foreground transition duration-150"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="보내기"
                className="w-11 h-11 rounded-md bg-primary text-on-primary border-2 border-foreground shadow-sticker flex items-center justify-center shrink-0 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
              >
                <i className="ph-bold ph-paper-plane-right text-lg"></i>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default ChatBot
