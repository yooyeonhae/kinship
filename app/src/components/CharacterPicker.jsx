import { ZODIAC_CHARACTERS } from '../lib/avatars'

// 캐릭터 고르기. 구성원을 만들 때(온보딩)와 나중에 바꿀 때(부모 할일 화면) 같은 걸 쓴다.
function CharacterPicker({ value, onSelect, size = 'md' }) {
  const box = size === 'sm' ? 'w-9 h-9 text-[18px]' : 'w-11 h-11 text-[22px]'

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="띠 캐릭터 선택">
      {ZODIAC_CHARACTERS.map(({ emoji, label }) => {
        const selected = value === emoji
        return (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={selected}
            // 이모지만 읽어주면 "생쥐 얼굴" 같은 소리가 나서 띠 이름이 전달되지 않는다
            aria-label={`${label}띠`}
            title={`${label}띠`}
            onClick={() => onSelect(emoji)}
            className={`${box} rounded-full flex items-center justify-center transition duration-150 active:scale-90 ${
              selected
                ? 'bg-tape-yellow border-2 border-foreground shadow-sticker'
                : 'bg-surface-muted border border-border'
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        )
      })}
    </div>
  )
}

export default CharacterPicker
