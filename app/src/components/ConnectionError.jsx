function ConnectionError({ onRetry }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <i className="ph-duotone ph-cloud-slash text-6xl text-foreground-muted" aria-hidden="true"></i>
        <h1 className="font-display font-extrabold text-heading mt-4">연결이 안 돼요</h1>
        <p className="text-foreground-muted text-body mt-2">
          인터넷 연결을 확인한 뒤 다시 시도해주세요. 가족 정보는 그대로 남아 있어요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 w-full bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker py-4 flex items-center justify-center gap-2 font-display font-bold text-[17px] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          <i className="ph-bold ph-arrow-clockwise text-lg"></i>
          다시 시도
        </button>
      </div>
    </div>
  )
}

export default ConnectionError
