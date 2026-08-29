import { useFamily } from '../context/FamilyContext'
import TopMenu from './TopMenu'

function Header() {
  const { familyName } = useFamily()

  return (
    <header className="flex items-center justify-between gap-2 px-1 py-2 mb-6 border-b border-border">
      <span className="font-doodle font-bold text-[23px] text-foreground truncate">{familyName || '우리가족'}</span>
      <TopMenu />
    </header>
  )
}

export default Header
