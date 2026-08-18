const TODAY_LABEL = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date())

function Header() {
  return (
    <header className="flex items-center justify-between px-1 py-2 mb-6 border-b border-border">
      <span className="font-doodle font-bold text-[19px] text-foreground">{TODAY_LABEL}</span>
      <div className="flex items-center gap-4 text-foreground-muted">
        <i className="ph ph-globe text-xl" aria-hidden="true"></i>
        <i className="ph ph-user-circle text-xl" aria-hidden="true"></i>
      </div>
    </header>
  )
}

export default Header
