import Header from './Header'
import BottomNav from './BottomNav'
import ChatBot from './ChatBot'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="max-w-md mx-auto px-6"
        style={{
          paddingTop: 'max(2rem, calc(1rem + env(safe-area-inset-top)))',
          paddingBottom: 'max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom)))',
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
