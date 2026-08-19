import { useFamily } from '../context/FamilyContext'

function Header() {
  const { familyName } = useFamily()

  return (
    <header className="flex items-center px-1 py-2 mb-6 border-b border-border">
      <span className="font-doodle font-bold text-[23px] text-foreground">{familyName || '우리가족'}</span>
    </header>
  )
}

export default Header
