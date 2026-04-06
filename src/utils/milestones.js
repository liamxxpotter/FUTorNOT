const KEY = 'futnot_vote_count'

export function getVoteCount() {
  return parseInt(localStorage.getItem(KEY) || '0', 10)
}

export function incrementVoteCount() {
  const next = getVoteCount() + 1
  localStorage.setItem(KEY, String(next))
  return next
}

const MILESTONES = [
  { at: 10,  message: "10 votes! Your taste is forming 🎧", gold: false },
  { at: 25,  message: "25 votes! You're a proper fan ⚽️",  gold: false },
  { at: 50,  message: "50 votes!! FIFA soundtrack scholar 🏆", gold: true },
  { at: 100, message: "100 VOTES. Absolute legend 🐐",      gold: true },
]

/** Returns a milestone object if `count` is exactly a milestone, else null. */
export function getMilestone(count) {
  return MILESTONES.find(m => m.at === count) || null
}
