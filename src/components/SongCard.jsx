export default function SongCard({ song, onVote, disabled, winner }) {
  const yearLabel = `FIFA ${song.fifa_year}`

  return (
    <div className={`song-card ${winner ? 'song-card--winner' : ''} ${disabled ? 'song-card--disabled' : ''}`}>
      <div className="song-card-badges">
        <span className="badge badge-year">{yearLabel}</span>
        {song.is_volta && <span className="badge badge-volta">VOLTA</span>}
      </div>

      {/* lite-youtube-embed web component — React renders unknown JSX tags to the DOM */}
      <div className="embed-wrapper">
        <lite-youtube videoid={song.youtube_id} playlabel={`Play ${song.title} by ${song.artist}`} />
      </div>

      <div className="song-info">
        <h2 className="song-title">{song.title}</h2>
        <p className="song-artist">{song.artist}</p>
      </div>

      <button
        className="vote-btn"
        onClick={onVote}
        disabled={disabled}
        aria-label={`Vote for ${song.title} by ${song.artist}`}
      >
        {winner ? '✓ Voted!' : 'This one 🔥'}
      </button>
    </div>
  )
}
