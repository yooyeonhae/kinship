import { Link } from 'react-router-dom'
import { useFamily } from '../context/FamilyContext'

const CHILD_STYLES = [
  { icon: 'ph-baseball-cap', bg: 'bg-pastel-mint', avatarText: 'text-member-1', rotate: '-rotate-1' },
  { icon: 'ph-flower-tulip', bg: 'bg-pastel-sky', avatarText: 'text-member-2', rotate: '' },
  { icon: 'ph-kite', bg: 'bg-tape-pink/30', avatarText: 'text-member-3', rotate: 'rotate-1' },
  { icon: 'ph-teddy-bear', bg: 'bg-tape-yellow/30', avatarText: 'text-member-4', rotate: '-rotate-2' },
]

function EntryScreen() {
  const { members, loading, resetFamily, setCurrentMember, familyId } = useFamily()
  const children = members.filter((m) => m.role === 'child')
  const parents = members.filter((m) => m.role === 'parent')

  function handleReset() {
    const ok = window.confirm(
      '이 기기에서 가족 연결을 해제하고 처음부터 다시 설정할까요?\n\n등록된 가족 정보와 할일은 서버에서 지워지지 않아요.'
    )
    if (ok) resetFamily()
  }

  return (
    <>
      <div className="mb-8">
        <span className="inline-block w-3 h-3 rounded-full bg-accent mb-3" aria-hidden="true"></span>
        <h1 className="font-display font-extrabold text-display">누가 확인할까요?</h1>
        <p className="text-foreground-muted text-body mt-2">
          이름을 누르면 그 사람에게 필요한 화면으로 바로 이동해요.
        </p>
      </div>

      <div className="mb-8">
        <p className="font-display font-bold text-label tracking-wide text-foreground-muted mb-3">
          우리 아이
        </p>
        {loading ? (
          <p className="text-foreground-muted text-body">불러오는 중...</p>
        ) : children.length === 0 ? (
          <p className="text-foreground-muted text-body">등록된 자녀가 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {children.map((child, idx) => {
              const style = CHILD_STYLES[idx % CHILD_STYLES.length]
              return (
                <Link
                  key={child.member_id}
                  to={`/child-outfit/${child.member_id}`}
                  onClick={() => setCurrentMember(child.member_id)}
                  className={`relative ${style.bg} text-foreground border-2 border-foreground rounded-md shadow-sticker p-5 pt-8 flex flex-col items-center gap-3 overflow-hidden aspect-square justify-between active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 ${style.rotate}`}
                >
                  <div className="w-20 h-20 rounded-full bg-surface ring-4 ring-surface shadow-soft flex items-center justify-center">
                    <i className={`ph-duotone ${style.icon} text-4xl ${style.avatarText}`} aria-hidden="true"></i>
                  </div>
                  <span className="font-display font-bold text-[18px] self-start">{child.name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-foreground-muted text-label">또는</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>

      {parents.length === 0 ? (
        <p className="text-foreground-muted text-body">등록된 부모가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((parent) => (
            <Link
              key={parent.member_id}
              // 부모 진입은 PIN 화면을 거친다. currentMember는 PIN 확인에 성공한 뒤 설정된다.
              to={`/parent-unlock/${parent.member_id}`}
              className="bg-secondary-dark text-on-secondary border-2 border-foreground rounded-md shadow-sticker px-5 py-4 flex items-center justify-between active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
            >
              <span className="flex items-center gap-3">
                <i className="ph-duotone ph-lock-key text-2xl" aria-hidden="true"></i>
                <span className="font-display font-bold text-body-lg">
                  {parents.length === 1 ? '부모로 시작하기' : `${parent.name}으로 시작하기`}
                </span>
              </span>
              <i className="ph-bold ph-caret-right text-xl" aria-hidden="true"></i>
            </Link>
          ))}
        </div>
      )}

      {/* 다른 기기에서 이 가족을 이어서 쓰려면 이 코드가 필요하다 */}
      <details className="mt-8 bg-surface border border-border rounded-md px-4 py-3">
        <summary className="font-display font-bold text-[13px] text-foreground-muted cursor-pointer">
          가족 코드 보기
        </summary>
        <p className="font-mono text-[12px] break-all leading-[18px] mt-2">{familyId}</p>
        <p className="text-foreground-muted text-[12px] leading-[18px] mt-2">
          다른 기기에서 이 코드를 넣으면 구성원을 다시 입력하지 않고 이어서 쓸 수 있어요.
        </p>
      </details>

      <button
        type="button"
        onClick={handleReset}
        className="mt-8 mx-auto flex items-center gap-1.5 text-foreground-muted text-label py-2 px-3 active:scale-95 transition duration-150"
      >
        <i className="ph ph-arrow-counter-clockwise text-sm" aria-hidden="true"></i>
        가족 다시 설정하기
      </button>
    </>
  )
}

export default EntryScreen
