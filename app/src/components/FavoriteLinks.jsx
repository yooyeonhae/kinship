import { useCallback, useEffect, useState } from 'react'
import { useFamily } from '../context/FamilyContext'

// PRD 3.7 — 앱은 링크 연결까지만 담당한다. 영상을 iframe으로 심지 않는 건 의도적이다:
// 퇴근길의 행동은 "지금 재생"이 아니라 "저장해두고 집에서 열기"이고, 유튜브 앱으로
// 넘겨주면 로그인·화질·PIP가 전부 따라온다.

const TABS = [
  { key: 'video', label: '영상', icon: 'ph-play-circle', placeholder: '유튜브 · 쇼츠 · 인스타 주소 붙여넣기' },
  { key: 'shopping', label: '장보기', icon: 'ph-shopping-cart', placeholder: '마켓컬리 · 쿠팡 등 상품 주소 붙여넣기' },
]

// 마이그레이션 04를 아직 실행하지 않으면 새 열이 없어 여기서 처음 막힌다.
// 원인을 모르면 "저장이 안 된다"로만 보이므로 메시지로 구분해준다.
function saveErrorMessage(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`
  if (/column .* does not exist|link_type|thumbnail_url/i.test(text)) {
    return '데이터베이스에 migration_04를 아직 적용하지 않았어요. Supabase SQL Editor에서 실행해주세요.'
  }
  if (error?.code === '42501') return '링크 저장은 부모만 할 수 있어요.'
  if (/favorite_links_url_check/.test(text)) return 'http로 시작하는 주소만 저장할 수 있어요.'
  return '링크를 저장하지 못했어요.'
}

function FavoriteLinks() {
  const { supabase, familyId } = useFamily()

  const [tab, setTab] = useState('video')
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [url, setUrl] = useState('')
  const [draft, setDraft] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!familyId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('favorite_links')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setErrorMsg('저장한 링크를 불러오지 못했어요.')
      setLoading(false)
      return
    }
    setErrorMsg('')
    setLinks(data || [])
    setLoading(false)
  }, [supabase, familyId])

  useEffect(() => {
    load()
  }, [load])

  // 붙여넣자마자 제목을 읽어온다. 실패해도 저장은 막지 않고 제목만 직접 쓰게 둔다.
  async function lookup(e) {
    e.preventDefault()
    const raw = url.trim()
    if (!raw || fetching) return
    setErrorMsg('')
    setFetching(true)
    try {
      const res = await fetch(`/api/linkmeta?url=${encodeURIComponent(raw)}`)
      const meta = await res.json()
      if (!res.ok) {
        setErrorMsg(meta.error || '링크를 읽지 못했어요.')
        setFetching(false)
        return
      }
      setDraft({
        url: raw,
        linkType: meta.linkType || tab,
        platform: meta.platform || '링크',
        title: meta.title || '',
        thumbnail: meta.thumbnail || null,
        autoTitled: Boolean(meta.title),
      })
    } catch {
      // 쿠팡·마켓컬리처럼 봇 요청을 막는 곳이 있어 조회 실패는 정상 경로에 가깝다
      setDraft({ url: raw, linkType: tab, platform: '링크', title: '', thumbnail: null, autoTitled: false })
    }
    setFetching(false)
  }

  async function save() {
    if (!draft || saving) return
    const title = draft.title.trim()
    if (!title) {
      setErrorMsg('제목을 입력해주세요.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('favorite_links')
      .insert({
        family_id: familyId,
        platform: draft.platform,
        link_type: draft.linkType,
        url: draft.url,
        title,
        thumbnail_url: draft.thumbnail,
      })
      .select()
      .single()
    setSaving(false)
    if (error) {
      setErrorMsg(saveErrorMessage(error))
      return
    }
    setErrorMsg('')
    setLinks((prev) => [data, ...prev])
    setTab(draft.linkType)
    setDraft(null)
    setUrl('')
  }

  async function remove(link) {
    const { error } = await supabase.from('favorite_links').delete().eq('link_id', link.link_id)
    if (error) {
      setErrorMsg('링크를 삭제하지 못했어요.')
      return
    }
    setLinks((prev) => prev.filter((l) => l.link_id !== link.link_id))
  }

  const visible = links.filter((l) => l.link_type === tab)
  const active = TABS.find((t) => t.key === tab)

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-extrabold text-[19px]">
          <span className="bg-tape-yellow/70 px-1.5 -rotate-1 inline-block">퇴근길 저장함</span>
        </h2>
        <span className="text-foreground-muted text-[12px]">{links.length}개</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md py-2.5 font-display font-bold text-[14px] border flex items-center justify-center gap-1.5 transition duration-150 ${
              tab === t.key
                ? 'bg-secondary-dark text-on-secondary border-foreground'
                : 'bg-surface text-foreground-muted border-border'
            }`}
            aria-pressed={tab === t.key}
          >
            <i className={`ph-bold ${t.icon} text-base`} aria-hidden="true"></i>
            {t.label}
          </button>
        ))}
      </div>

      {!draft ? (
        <form onSubmit={lookup} className="flex items-center gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={active.placeholder}
            className="flex-1 min-w-0 bg-surface rounded-md px-3 py-2.5 text-[14px] border border-border outline-none focus:border-foreground transition duration-150"
            autoComplete="off"
            inputMode="url"
          />
          <button
            type="submit"
            disabled={fetching}
            className="w-11 h-11 rounded-md bg-primary text-on-primary border-2 border-foreground shadow-sticker flex items-center justify-center shrink-0 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-60"
            aria-label="링크 정보 가져오기"
          >
            <i className={`ph-bold ${fetching ? 'ph-circle-notch' : 'ph-magic-wand'} text-lg`}></i>
          </button>
        </form>
      ) : (
        <div className="bg-surface border-2 border-foreground rounded-md shadow-sticker p-3 mb-4">
          <div className="flex gap-3">
            {draft.thumbnail ? (
              <img src={draft.thumbnail} alt="" className="w-24 h-[54px] object-cover rounded-sm bg-surface-muted shrink-0" />
            ) : (
              <div className="w-24 h-[54px] rounded-sm bg-surface-muted flex items-center justify-center shrink-0">
                <i className="ph-duotone ph-link text-xl text-foreground-muted" aria-hidden="true"></i>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-display font-bold text-foreground-muted">{draft.platform}</p>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="제목을 입력해주세요"
                className="w-full mt-1 bg-surface-muted rounded-sm px-2 py-1.5 text-[14px] border border-border outline-none"
              />
            </div>
          </div>
          {!draft.autoTitled && (
            <p className="text-foreground-muted text-[12px] leading-[18px] mt-2">
              이 사이트는 제목을 자동으로 읽어오지 못했어요. 직접 적어주세요.
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 bg-secondary-dark text-on-secondary rounded-md py-2.5 font-display font-bold text-[14px] active:scale-[0.97] transition duration-150 disabled:opacity-60"
            >
              {saving ? '저장하는 중...' : '저장하기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null)
                setErrorMsg('')
              }}
              className="px-4 py-2.5 text-foreground-muted font-display font-bold text-[14px] active:scale-95 transition duration-150"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {errorMsg && <p className="text-[13px] text-destructive mb-3">{errorMsg}</p>}

      {loading ? (
        <p className="text-foreground-muted text-[14px] py-2">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <p className="text-foreground-muted text-[14px] py-2">
          저장한 {active.label} 링크가 아직 없어요. 주소를 붙여넣으면 제목을 자동으로 채워드려요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((link) => (
            <li key={link.link_id} className="bg-surface border border-border rounded-md shadow-soft flex items-stretch overflow-hidden">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-3 p-2.5 active:scale-[0.99] transition duration-150"
              >
                {link.thumbnail_url ? (
                  <img src={link.thumbnail_url} alt="" className="w-[76px] h-[43px] object-cover rounded-sm bg-surface-muted shrink-0" />
                ) : (
                  <div className="w-[76px] h-[43px] rounded-sm bg-surface-muted flex items-center justify-center shrink-0">
                    <i className={`ph-duotone ${link.link_type === 'video' ? 'ph-play-circle' : 'ph-shopping-bag'} text-xl text-foreground-muted`} aria-hidden="true"></i>
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block font-display font-bold text-[14px] leading-tight line-clamp-2">{link.title || link.url}</span>
                  <span className="block text-[11px] text-foreground-muted mt-0.5">{link.platform}</span>
                </span>
              </a>
              <button
                type="button"
                onClick={() => remove(link)}
                className="px-3 border-l border-border text-foreground-muted active:scale-95 transition duration-150"
                aria-label={`${link.title || link.url} 삭제`}
              >
                <i className="ph-bold ph-trash text-base"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default FavoriteLinks
