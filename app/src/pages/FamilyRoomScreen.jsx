import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// 더미 데이터 — Supabase 연결 전 하드코딩 (screens/js/store.js DEFAULTS와 동일)
const INITIAL_CHAT = [
  { id: 'm1', sender: '서연', memberTag: 'member-3', content: '얘들아 엄마 오늘 좀 늦을 것 같아, 저녁 챙겨 먹고 있어!', ts: 1 },
  { id: 'm2', sender: '하준', memberTag: 'member-1', content: '넵! 숙제 다 하고 게임하고 있을게요', ts: 2 },
]

const SENDER_OPTIONS = [
  { name: '하준', tag: 'member-1' },
  { name: '서아', tag: 'member-2' },
  { name: '서연', tag: 'member-3' },
  { name: '민준', tag: 'member-4' },
]

const MEMBER_BG_CLASS = {
  'member-1': 'bg-member-1',
  'member-2': 'bg-member-2',
  'member-3': 'bg-member-3',
  'member-4': 'bg-member-4',
}

const GAME_TABS = [
  { key: 'sum15', label: '합이 15', sub: '숫자 3개로 15 만들기', icon: 'ph-hash', bgClass: 'bg-pastel-mint' },
  { key: 'bingo', label: '계산 빙고', sub: '암산으로 한 줄 빙고', icon: 'ph-grid-four', bgClass: 'bg-pastel-sky' },
  { key: 'stairs', label: '계단 오르기', sub: '주사위로 먼저 도착하기', icon: 'ph-flag-checkered', bgClass: 'bg-tape-pink/25' },
]

const BINGO_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const STAIRS_TARGET = 30

let nextId = 100

function formatChatTime(ts) {
  if (!ts || ts < 1e6) return ''
  const d = new Date(ts)
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  const m = d.getMinutes()
  return `${period} ${h12}:${m < 10 ? '0' : ''}${m}`
}

function hasSum15(arr) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      for (let k = j + 1; k < arr.length; k++)
        if (arr[i] + arr[j] + arr[k] === 15) return true
  return false
}

function newSum15State() {
  return { owners: {}, p1Nums: [], p2Nums: [], turn: 'p1', winner: null }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeBingoBoard() {
  const pool = []
  for (let i = 2; i <= 20; i++) pool.push(i)
  shuffle(pool)
  return pool.slice(0, 9).map((v) => ({ value: v, marked: false }))
}

function randomBingoProblem() {
  const a = 2 + Math.floor(Math.random() * 8)
  const b = 2 + Math.floor(Math.random() * 8)
  const op = Math.random() < 0.5 ? '+' : '×'
  const answer = op === '+' ? a + b : a * b
  return { text: `${a} ${op} ${b}`, answer }
}

function checkBingoWin(board) {
  return BINGO_LINES.some((line) => line.every((i) => board[i].marked))
}

function newBingoState() {
  return { boards: { p1: makeBingoBoard(), p2: makeBingoBoard() }, turn: 'p1', winner: null, problem: randomBingoProblem() }
}

function newStairsState() {
  return { p1: 0, p2: 0, turn: 'p1', winner: null }
}

function FamilyRoomScreen() {
  const [messages, setMessages] = useState(INITIAL_CHAT)
  const [chatSender, setChatSender] = useState('하준')
  const [chatInput, setChatInput] = useState('')
  const chatLogRef = useRef(null)

  const [player1, setPlayer1] = useState('하준')
  const [player2, setPlayer2] = useState('서아')
  const [activeGame, setActiveGame] = useState('sum15')

  const [sum15, setSum15] = useState(newSum15State)
  const [bingo, setBingo] = useState(newBingoState)
  const [stairs, setStairs] = useState(newStairsState)

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
  }, [messages])

  function handleChatSubmit(e) {
    e.preventDefault()
    const v = chatInput.trim()
    if (!v) return
    const tag = SENDER_OPTIONS.find((s) => s.name === chatSender)?.tag || 'member-1'
    setMessages((prev) => [...prev, { id: `m${nextId++}`, sender: chatSender, memberTag: tag, content: v, ts: Date.now() }])
    setChatInput('')
  }

  function handleSum15Pick(n) {
    setSum15((prev) => {
      if (prev.owners[n] || prev.winner) return prev
      const owners = { ...prev.owners, [n]: prev.turn }
      const numsKey = prev.turn === 'p1' ? 'p1Nums' : 'p2Nums'
      const nums = [...prev[numsKey], n]
      let winner = null
      if (nums.length >= 3 && hasSum15(nums)) winner = prev.turn
      else if (Object.keys(owners).length === 9) winner = 'draw'
      return { ...prev, owners, [numsKey]: nums, winner, turn: winner ? prev.turn : prev.turn === 'p1' ? 'p2' : 'p1' }
    })
  }

  function handleBingoClick(owner, idx) {
    setBingo((prev) => {
      if (prev.winner || owner !== prev.turn) return prev
      const board = prev.boards[owner]
      const cell = board[idx]
      let newBoard = board
      if (!cell.marked && cell.value === prev.problem.answer) {
        newBoard = board.map((c, i) => (i === idx ? { ...c, marked: true } : c))
      }
      const boards = { ...prev.boards, [owner]: newBoard }
      const winner = checkBingoWin(newBoard) ? owner : null
      return {
        ...prev,
        boards,
        winner,
        turn: winner ? prev.turn : owner === 'p1' ? 'p2' : 'p1',
        problem: winner ? prev.problem : randomBingoProblem(),
      }
    })
  }

  function handleStairsRoll() {
    setStairs((prev) => {
      if (prev.winner) return prev
      const roll = 1 + Math.floor(Math.random() * 6)
      const cur = prev.turn
      const newVal = prev[cur] + roll
      const winner = newVal >= STAIRS_TARGET ? cur : null
      return { ...prev, [cur]: newVal, winner, turn: winner ? prev.turn : cur === 'p1' ? 'p2' : 'p1' }
    })
  }

  const activeState = activeGame === 'sum15' ? sum15 : activeGame === 'bingo' ? bingo : stairs
  const turnIndicatorText = activeState.winner
    ? activeState.winner === 'draw'
      ? '무승부!'
      : `${activeState.winner === 'p1' ? player1 : player2} 승리!`
    : `차례: ${activeState.turn === 'p1' ? player1 : player2}`

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition duration-150" aria-label="처음으로">
          <i className="ph-bold ph-caret-left text-xl text-foreground-muted" aria-hidden="true"></i>
        </Link>
        <div className="w-10"></div>
      </div>

      <div className="bg-surface border border-border rounded-md px-4 py-3 mb-6 shadow-soft">
        <p className="font-display font-bold text-[15px] text-secondary flex items-center gap-2">
          <i className="ph-duotone ph-house-line text-lg" aria-hidden="true"></i>가족 아지트 (채팅 & 게임)
        </p>
        <p className="text-foreground-muted text-[13px] leading-[18px] mt-1">부모님이 잠깐 자리를 비워도 가족끼리 대화하고 같이 놀 수 있어요.</p>
      </div>

      <div className="relative bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-6 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150">
        <span className="absolute -top-2 right-4 w-11 h-4 bg-tape-pink/90 rotate-[5deg] rounded-sm" aria-hidden="true"></span>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-bold text-[15px] flex items-center gap-2">
            <i className="ph-duotone ph-chats-circle text-xl text-primary"></i>우리 가족 톡
          </p>
          <div className="flex items-center -space-x-2">
            <span className="w-7 h-7 rounded-full bg-member-1 ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary">하</span>
            <span className="w-7 h-7 rounded-full bg-member-2 ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary">서</span>
            <span className="w-7 h-7 rounded-full bg-member-3 ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary">연</span>
            <span className="w-7 h-7 rounded-full bg-member-4 ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary">민</span>
            <span className="w-7 h-7 rounded-full bg-surface-muted ring-2 ring-surface shadow-soft flex items-center justify-center text-[13px] font-display font-bold text-foreground-muted" aria-hidden="true">+</span>
          </div>
        </div>
        <div className="border-t border-dashed border-border mb-3" aria-hidden="true"></div>
        <div ref={chatLogRef} className="flex flex-col gap-3 max-h-64 overflow-y-auto mb-3 pr-1">
          {messages.map((m) => {
            const time = formatChatTime(m.ts)
            return (
              <div key={m.id} className="flex items-start gap-2">
                <span
                  className={`w-7 h-7 rounded-full ${MEMBER_BG_CLASS[m.memberTag]} ring-2 ring-surface shadow-soft flex items-center justify-center text-[11px] font-display font-bold text-on-primary shrink-0`}
                >
                  {m.sender.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-display font-bold text-foreground-muted mb-1">{m.sender}</p>
                  <div className="inline-block bg-tape-yellow/70 rounded-lg rounded-tl-none px-3 py-2 max-w-full">
                    <p className="text-[14px] leading-[20px] text-foreground">{m.content}</p>
                  </div>
                  {time && <p className="text-[11px] text-foreground-muted mt-1">{time}</p>}
                </div>
              </div>
            )
          })}
        </div>
        <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
          <select
            value={chatSender}
            onChange={(e) => setChatSender(e.target.value)}
            className="bg-surface-muted rounded-full px-3 py-2.5 text-[13px] font-display font-bold border border-border outline-none shrink-0"
          >
            {SENDER_OPTIONS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메시지를 입력"
            className="flex-1 bg-surface-muted rounded-full px-4 py-2.5 text-[14px] border border-border outline-none min-w-0"
            autoComplete="off"
          />
          <button type="submit" className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 active:scale-90 transition duration-150" aria-label="보내기">
            <i className="ph-bold ph-paper-plane-right text-base"></i>
          </button>
        </form>
      </div>

      <div className="relative bg-foreground border-2 border-foreground rounded-md shadow-sticker p-card-padding mb-4 rotate-[-1deg]">
        <span className="absolute -top-2 left-6 w-11 h-4 bg-tape-yellow/90 rotate-[-4deg] rounded-sm" aria-hidden="true"></span>
        <div className="flex items-center justify-between gap-2">
          <p className="font-display font-bold text-[15px] flex items-center gap-2 text-on-primary">
            <i className="ph-duotone ph-game-controller text-xl text-tape-yellow"></i>미니게임존
          </p>
          <span className="bg-tape-yellow text-foreground font-display font-bold text-[12px] rounded-full px-3 py-1 whitespace-nowrap" aria-hidden="true">
            가족 포인트: 1,250p
          </span>
        </div>
        <p className="text-[13px] text-white/70 mt-2">턴제 게임으로 온 가족이 함께 놀아요.</p>
      </div>

      <div className="relative bg-surface border-2 border-foreground rounded-md shadow-sticker p-card-padding active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150">
        <p className="font-display font-bold text-[15px] mb-3 flex items-center gap-2">
          <i className="ph-duotone ph-users-three text-xl text-accent"></i>선수 선택 · 턴제 대전
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <select value={player1} onChange={(e) => setPlayer1(e.target.value)} className="bg-surface-muted rounded-md px-2 py-2 text-[13px] border border-border outline-none">
            {SENDER_OPTIONS.map((s) => (
              <option key={s.name} value={s.name}>
                선수1 · {s.name}
              </option>
            ))}
          </select>
          <select value={player2} onChange={(e) => setPlayer2(e.target.value)} className="bg-surface-muted rounded-md px-2 py-2 text-[13px] border border-border outline-none">
            {SENDER_OPTIONS.map((s) => (
              <option key={s.name} value={s.name}>
                선수2 · {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveGame(tab.key)}
              className={`game-tab relative flex flex-col items-start gap-1 ${tab.bgClass} border border-border rounded-md p-3 text-left transition duration-150`}
              data-active={activeGame === tab.key}
            >
              <span className="game-tab-dot absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-border" aria-hidden="true"></span>
              <i className={`ph-bold ${tab.icon} text-xl text-foreground`} aria-hidden="true"></i>
              <span className="font-display font-bold text-[13px] text-foreground">{tab.label}</span>
              <span className="text-[11px] text-foreground-muted leading-tight">{tab.sub}</span>
            </button>
          ))}
          <div className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-border rounded-md p-3 text-foreground-muted" aria-hidden="true">
            <i className="ph-bold ph-plus-circle text-xl"></i>
            <span className="text-[11px] font-display font-bold text-center leading-tight">
              새로운 게임
              <br />
              준비 중
            </span>
          </div>
        </div>

        <p className="text-[14px] font-display font-bold mb-3">{turnIndicatorText}</p>

        {activeGame === 'sum15' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">번갈아 숫자를 하나씩 가져가서, 내가 가진 숫자 3개의 합이 15가 되면 승리해요.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
                const owner = sum15.owners[n] || undefined
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleSum15Pick(n)}
                    disabled={!!owner || !!sum15.winner}
                    data-owner={owner}
                    className="num-cell bg-surface-muted border border-border rounded-md py-3 font-display font-bold text-[18px] active:scale-95 transition duration-150"
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {sum15.winner ? (sum15.winner === 'draw' ? '무승부예요!' : `${sum15.winner === 'p1' ? player1 : player2} 승리!`) : ' '}
            </p>
            <button
              type="button"
              onClick={() => setSum15(newSum15State())}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'bingo' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">내 차례에 문제가 나오면, 내 판에서 정답 칸을 찾아 눌러요. 먼저 한 줄을 완성하면 승리해요.</p>
            <div className="bg-surface-muted rounded-md px-4 py-3 text-center mb-3">
              <p className="text-[13px] text-foreground-muted">문제</p>
              <p className="font-display font-extrabold text-[28px]">{bingo.winner ? '-' : bingo.problem.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              {['p1', 'p2'].map((key) => (
                <div key={key}>
                  <p className="text-[12px] font-display font-bold text-center mb-1">{key === 'p1' ? player1 : player2}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {bingo.boards[key].map((cell, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleBingoClick(key, idx)}
                        data-marked={cell.marked}
                        className="bingo-cell bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-95 transition duration-150"
                      >
                        {cell.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {bingo.winner ? `${bingo.winner === 'p1' ? player1 : player2} 승리! 한 줄을 완성했어요.` : ' '}
            </p>
            <button
              type="button"
              onClick={() => setBingo(newBingoState())}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}

        {activeGame === 'stairs' && (
          <div>
            <p className="text-[13px] text-foreground-muted mb-3">내 차례에 주사위를 굴려 계단을 올라가요. 먼저 목표 높이(30)에 도착하면 승리해요.</p>
            <div className="flex flex-col gap-3 mb-3">
              {['p1', 'p2'].map((key) => {
                const pct = Math.min(100, Math.round((stairs[key] / STAIRS_TARGET) * 100))
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-[13px] font-display font-bold mb-1">
                      <span>{key === 'p1' ? player1 : player2}</span>
                      <span>
                        {stairs[key]} / {STAIRS_TARGET}
                      </span>
                    </div>
                    <div className="h-3 bg-surface-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${key === 'p1' ? 'bg-primary' : 'bg-accent'} rounded-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleStairsRoll}
              disabled={!!stairs.winner}
              className="w-full bg-primary text-on-primary rounded-md py-3 flex items-center justify-center gap-2 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150 mb-2"
            >
              <i className="ph-bold ph-dice-five"></i>주사위 굴리기
            </button>
            <p className="text-[14px] font-display font-bold text-center mb-3">
              {stairs.winner ? `${stairs.winner === 'p1' ? player1 : player2} 승리! 먼저 꼭대기에 도착했어요.` : ' '}
            </p>
            <button
              type="button"
              onClick={() => setStairs(newStairsState())}
              className="w-full bg-surface-muted border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150"
            >
              새 게임
            </button>
          </div>
        )}
      </div>

      <div className="flex-1"></div>
    </>
  )
}

export default FamilyRoomScreen
