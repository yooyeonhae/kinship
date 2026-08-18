import { Link, useLocation } from 'react-router-dom'

const CHILD_PATH_RE = /^\/(child-outfit|child-todo)\/([^/]+)/

function BottomNav() {
  const { pathname } = useLocation()
  const childMatch = pathname.match(CHILD_PATH_RE)

  const tabs = [
    { label: '홈', emoji: '🏠', to: '/' },
    { label: '할일', emoji: '✅', to: childMatch ? `/child-todo/${childMatch[2]}` : '/parent-tasks' },
    { label: '정보', emoji: '📰', to: '/info-feed' },
    { label: '주말', emoji: '🎈', to: '/weekend' },
    { label: '아지트', emoji: '⛺', to: '/family-room' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.to === pathname
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
