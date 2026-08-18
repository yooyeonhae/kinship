import { Link } from 'react-router-dom'

function ParentRecipeScreen() {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-[28px] leading-[34px]">퇴근 길 메뉴 고민은 그만!</h1>
        <p className="flex items-center gap-1.5 text-foreground-muted text-[15px] leading-[22px] mt-2">
          오늘의 추천 메뉴입니다
          <i className="ph-fill ph-heart text-accent text-base" aria-hidden="true"></i>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="-rotate-1 bg-surface border-2 border-foreground rounded-md shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150">
          <div className="relative">
            <div className="aspect-[4/3] rounded-t-[14px] overflow-hidden bg-surface-muted flex items-center justify-center">
              <i className="ph-duotone ph-bowl-food text-6xl text-foreground-muted" aria-hidden="true"></i>
            </div>
            <span className="absolute -bottom-3 right-3 w-8 h-8 rounded-full bg-accent ring-4 ring-surface shadow-soft flex items-center justify-center" aria-hidden="true">
              <i className="ph-fill ph-star text-on-accent text-xs"></i>
            </span>
          </div>
          <div className="p-3 pt-4">
            <h2 className="font-display font-extrabold text-[15px] leading-tight mb-1">된장찌개 정식</h2>
            <p className="text-[12px] text-foreground-muted leading-snug mb-2 line-clamp-2">두부, 애호박, 감자만 있으면 충분해요.</p>
            <div className="border-t border-dashed border-border pt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-primary">
                <i className="ph-bold ph-clock"></i>15분
              </span>
              <i className="ph ph-heart text-foreground-muted text-base" aria-hidden="true"></i>
            </div>
          </div>
        </div>

        <div className="rotate-2 bg-surface border-2 border-foreground rounded-md shadow-sticker active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150">
          <div className="relative">
            <div className="aspect-[4/3] rounded-t-[14px] overflow-hidden bg-surface-muted flex items-center justify-center">
              <i className="ph-duotone ph-cooking-pot text-6xl text-foreground-muted" aria-hidden="true"></i>
            </div>
            <span className="absolute -top-3 left-3 w-8 h-8 rounded-full bg-primary ring-4 ring-surface shadow-soft flex items-center justify-center" aria-hidden="true">
              <i className="ph-fill ph-star text-on-primary text-xs"></i>
            </span>
          </div>
          <div className="p-3 pt-4">
            <h2 className="font-display font-extrabold text-[15px] leading-tight mb-1">소불고기 덮밥</h2>
            <p className="text-[12px] text-foreground-muted leading-snug mb-2 line-clamp-2">양파, 당근을 잘게 썰어 함께 볶기만 하면 돼요.</p>
            <div className="border-t border-dashed border-border pt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-secondary">
                <i className="ph-bold ph-clock"></i>20분
              </span>
              <i className="ph ph-heart text-foreground-muted text-base" aria-hidden="true"></i>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#"
        className="mt-5 flex items-center justify-center gap-2 bg-surface border border-border rounded-full shadow-soft py-3 font-display font-bold text-[15px] active:scale-[0.97] transition duration-150"
      >
        <i className="ph-fill ph-play-circle text-lg"></i>
        즐겨찾기 영상 (Recipe Video)
      </a>

      <div className="flex-1"></div>

      <Link
        to="/parent-tasks"
        className="mt-6 bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
      >
        확인 (To Tasks)
        <i className="ph-bold ph-arrow-right text-lg"></i>
      </Link>
    </>
  )
}

export default ParentRecipeScreen
