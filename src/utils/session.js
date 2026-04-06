const SESSION_KEY = 'futnot_session_id'

/**
 * Returns a stable anonymous session ID for this browser.
 * Generated once via crypto.randomUUID() and stored in localStorage.
 * Used for per-session pair deduplication in the Postgres vote function.
 */
export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
