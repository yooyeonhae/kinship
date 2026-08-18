import { Link, useLocation } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

function BottomNav() {
  const { pathname } = useLocation()
  const { isChild, currentMemberId } = useFamily()

  // "할일" 탭 목적지는 지금 앱을 쓰는 사람의 역할로 정한다.
  // 예전에는 현재 URL이 child-* 인지로 판단해서, 자녀가 다른 탭을 한 번 거치면
  // 부모 화면으로 새는 문제가 있었다.
  const todoTarget = isChild && currentMemberId ? `/child-todo/${currentMemberId}` : '/parent-tasks'

  const tabs = [
    { label: '홈', emoji: '🏠', to: '/', matches: (p) => p === '/' },
    {
      label: '할일',
      emoji: '✅',
      to: todoTarget,
      matches: (p) => p.startsWith('/child-todo') || p === '/parent-tasks' || p === '/parent-progress',
    },
    { label: '정보', emoji: '📰', to: '/info-feed', matches: (p) => p === '/info-feed' },
    { label: '주말', emoji: '🎈', to: '/weekend', matches: (p) => p === '/weekend' },
    { label: '아지트', emoji: '⛺', to: '/family-room', matches: (p) => p === '/family-room' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.matches(pathname)
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className="flex flex-col items-center gap-1 py-2.5 active:scale-95 transition duration-150"
              aria-current={active ? 'page' : 'false'}
            >
              <span className={`text-xl ${active ? '' : 'opacity-60 grayscale'}`} aria-hidden="true">
                {tab.emoji}
              </span>
              <span className={`text-[11px] ${active ? 'text-primary font-bold' : 'text-foreground-muted'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
