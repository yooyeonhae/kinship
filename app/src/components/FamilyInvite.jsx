import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// 36자리 코드를 손으로 옮겨 적는 건 아이가 할 수 있는 일이 아니다.
// 링크 한 번이면 join이 자동으로 끝나고, 그 뒤로는 이 기기에 저장되므로
// 다시 입력할 일이 없다. QR은 그 링크를 종이에 붙여둘 수 있게 하는 용도.
function inviteLink(familyId) {
  return `${window.location.origin}/onboarding?code=${familyId}`
}

function FamilyInvite({ familyId, compact = false }) {
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState(null)
  const [showCode, setShowCode] = useState(false)

  const link = inviteLink(familyId)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: '#2B2A28', light: '#FFFFFF' } })
      .then((url) => {
        if (alive) setQr(url)
      })
      .catch(() => {
        // QR을 못 그려도 링크 복사는 그대로 쓸 수 있다
        if (alive) setQr(null)
      })
    return () => {
      alive = false
    }
  }, [link])

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
    } catch {
      // 클립보드가 막힌 환경(비 HTTPS 등)에서는 화면의 값을 직접 옮기면 된다
      setCopied(null)
    }
  }

  return (
    <div className={compact ? '' : 'mt-5'}>
      {qr && (
        <div className="flex justify-center">
          <img
            src={qr}
            alt="가족 초대 QR 코드"
            className="w-40 h-40 bg-white rounded-md border border-border p-2"
          />
        </div>
      )}

      <p className="text-foreground-muted text-[13px] leading-[20px] mt-3 text-center">
        아이 휴대폰 카메라로 이 QR을 찍으면 바로 들어와요. 한 번만 하면 그 기기에 저장돼서 다음부터는 그냥 열면 돼요.
      </p>

      <div className="flex flex-col gap-2 mt-4">
        <button
          type="button"
          onClick={() => copy(link, 'link')}
          className="w-full bg-surface border border-border rounded-md py-2.5 font-display font-bold text-[14px] active:scale-95 transition duration-150"
        >
          {copied === 'link' ? '초대 링크를 복사했어요' : '초대 링크 복사하기'}
        </button>

        <button
          type="button"
          onClick={() => setShowCode((v) => !v)}
          className="text-[12px] text-foreground-muted py-1 active:scale-95 transition duration-150"
        >
          {showCode ? '가족 코드 접기' : '가족 코드 직접 보기'}
        </button>
      </div>

      {showCode && (
        <div className="mt-1 bg-surface-muted rounded-md px-3 py-2.5">
          <p className="font-mono text-[12px] break-all leading-[18px]">{familyId}</p>
          <button
            type="button"
            onClick={() => copy(familyId, 'code')}
            className="mt-2 text-[12px] font-display font-bold text-primary active:scale-95 transition duration-150"
          >
            {copied === 'code' ? '복사했어요' : '코드 복사하기'}
          </button>
        </div>
      )}
    </div>
  )
}

export default FamilyInvite
