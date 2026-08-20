import Header from './Header'
import BottomNav from './BottomNav'
import ChatBot from './ChatBot'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div
        className="max-w-md mx-auto px-6"
        style={{
          paddingTop: 'max(2rem, calc(1rem + env(safe-area-inset-top)))',
          // 하단 탭바(약 4.5rem)에 더해 챗봇 스티커가 bottom-20에서 위로 2.5rem을 더 차지한다.
          // 그만큼 비워두지 않으면 마지막 카드가 스티커에 영원히 가려진다.
          paddingBottom: 'max(8rem, calc(7rem + env(safe-area-inset-bottom)))',
        }}
      >
        <Header />
        {children}
      </div>
      <ChatBot />
      <BottomNav />
    </div>
  )
}

export default Layout
