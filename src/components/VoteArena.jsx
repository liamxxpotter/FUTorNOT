import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { usePair } from '../hooks/usePair'
import { getSessionId } from '../utils/session'
import { incrementVoteCount, getMilestone } from '../utils/milestones'
import SongCard from './SongCard'
import ShareButton from './ShareButton'

const VOTE_EMOJIS = ['⚽️', '🔥', '🏆', '🤩', '🥇', '🏟️', '🎯', '🤙']
const NORMAL_ANIMS = ['anim-float', 'anim-spin', 'anim-bounce', 'anim-slingshot']
const SILLY_ANIMS  = ['anim-drunk', 'anim-mega', 'anim-nope',  'anim-orbit']

function pickAnim() {
  const pool = Math.random() < 0.25 ? SILLY_ANIMS : NORMAL_ANIMS
  return pool[Math.floor(Math.random() * pool.length)]
}

// Confetti dots for milestone celebrations
function Confetti() {
  const DOTS = 12
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: DOTS }, (_, i) => (
        <span key={i} className="confetti-dot" style={{ '--i': i }} />
      ))}
    </div>
  )
}

function MilestoneToast({ milestone, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`milestone-toast ${milestone.gold ? 'milestone-toast--gold' : ''}`}>
      {milestone.gold && <Confetti />}
      <span className="milestone-msg">{milestone.message}</span>
    </div>
  )
}

export default function VoteArena() {
  const { pair, loading, error, refetch } = usePair()
  const [votedFor, setVotedFor] = useState(null)
  const [voting, setVoting] = useState(false)
  const [burst, setBurst] = useState(null)
  const [shareData, setShareData] = useState(null)
  const [milestone, setMilestone] = useState(null)
  const pairRef = useRef(pair)
  pairRef.current = pair

  useEffect(() => {
    function onKey(e) {
      const p = pairRef.current
      if (!p || p.length < 2 || voting || votedFor) return
      if (e.key === 'ArrowLeft')  handleVote(p[0].id, p[1].id)
      if (e.key === 'ArrowRight') handleVote(p[1].id, p[0].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voting, votedFor])

  async function handleVote(winnerId, loserId) {
    if (voting || votedFor) return
    setVoting(true)
    setVotedFor(winnerId)
    setShareData(null)
    setBurst({
      emoji: VOTE_EMOJIS[Math.floor(Math.random() * VOTE_EMOJIS.length)],
      anim:  pickAnim(),
      key:   Date.now(),
    })

    const { data: rpcData, error: rpcError } = await supabase.rpc('record_vote', {
      p_winner_id:  winnerId,
      p_loser_id:   loserId,
      p_session_id: getSessionId(),
    })

    if (rpcError && !rpcError.message.includes('Duplicate')) {
      console.error('Vote error:', rpcError.message)
    }

    // Milestone check
    const newCount = incrementVoteCount()
    const hit = getMilestone(newCount)
    if (hit) setMilestone(hit)

    // Share data — fetch winner's new rank using ELO returned by record_vote
    if (!rpcError && rpcData) {
      const winnerElo = rpcData.winner_elo
      const winner = pairRef.current?.find(s => s.id === winnerId)
      if (winner && winnerElo != null) {
        const { count } = await supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .gt('elo', winnerElo)
        setShareData({
          title:  winner.title,
          artist: winner.artist,
          rank:   (count ?? 0) + 1,
          elo:    Math.round(winnerElo),
        })
      }
    }

    setTimeout(() => {
      setVotedFor(null)
      setVoting(false)
      setBurst(null)
      // shareData intentionally kept — shows as "Share last result" on next pair
      refetch()
    }, 900)
  }

  if (loading) {
    return (
      <div className="arena-state">
        <div className="spinner" />
        <p>Loading match…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="arena-state arena-state--error">
        <p>Error loading songs: {error}</p>
        <button className="vote-btn" onClick={refetch}>Try again</button>
      </div>
    )
  }

  if (!pair || pair.length < 2) {
    return (
      <div className="arena-state">
        <p>You've heard them all! 🎉</p>
        <p className="arena-sub">Check the leaderboard to see the rankings.</p>
      </div>
    )
  }

  const [songA, songB] = pair

  return (
    <div className="arena">
      <p className="arena-prompt">
        Which track slaps harder? <span className="arena-hint">← → to vote</span>
      </p>

      {milestone && (
        <MilestoneToast milestone={milestone} onDone={() => setMilestone(null)} />
      )}

      {burst && (
        <div key={burst.key} className={`emoji-burst ${burst.anim}`} aria-hidden="true">
          {burst.emoji}
        </div>
      )}

      <div className="arena-cards">
        <SongCard
          song={songA}
          onVote={() => handleVote(songA.id, songB.id)}
          disabled={voting}
          winner={votedFor === songA.id}
        />
        <div className="vs-divider">VS</div>
        <SongCard
          song={songB}
          onVote={() => handleVote(songB.id, songA.id)}
          disabled={voting}
          winner={votedFor === songB.id}
        />
      </div>

      {shareData && (
        <div className="share-row">
          <ShareButton data={shareData} />
        </div>
      )}
    </div>
  )
}
