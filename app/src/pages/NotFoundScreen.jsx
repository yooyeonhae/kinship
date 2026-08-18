import { Link } from 'react-router-dom'

function NotFoundScreen() {
  return (
    <div className="text-center py-10">
      <i className="ph-duotone ph-compass text-6xl text-foreground-muted" aria-hidden="true"></i>
      <h1 className="font-display font-extrabold text-heading mt-4">여기엔 아무것도 없어요</h1>
      <p className="text-foreground-muted text-body mt-2">주소가 잘못되었거나 사라진 화면이에요.</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center gap-2 bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker px-6 py-3 font-display font-bold text-[15px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
      >
        <i className="ph-bold ph-house text-base"></i>
        처음으로
      </Link>
    </div>
  )
}

export default NotFoundScreen
