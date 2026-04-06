import { useState } from 'react'

export default function ShareButton({ data }) {
  const [state, setState] = useState('idle') // 'idle' | 'copied'

  if (!data) return null

  const text = `"${data.title}" by ${data.artist} is ranked #${data.rank} on FUTorNOT with an ELO of ${data.elo} — do you agree? ${window.location.origin}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {}
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 1500)
    } catch {}
  }

  return (
    <button className="share-btn" onClick={handleShare}>
      {state === 'copied' ? '✓ Copied!' : '📤 Share last result'}
    </button>
  )
}
