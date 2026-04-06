/**
 * Vercel Cron Function — daily ELO snapshot
 *
 * Scheduled via vercel.json to run at midnight UTC every day.
 * Vercel automatically injects CRON_SECRET and passes it as a Bearer token
 * on cron-triggered requests — this guard rejects any other callers.
 *
 * Required env vars (set in Vercel dashboard):
 *   VITE_SUPABASE_URL          — already set for the frontend build
 *   SUPABASE_SERVICE_ROLE_KEY  — secret key from Supabase → Project Settings → API
 */
export default async function handler(req, res) {
  // Only allow GET (Vercel cron uses GET) and block everything else
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify the request is from Vercel's cron runner
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/take_elo_snapshot`, {
    method: 'POST',
    headers: {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type':  'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('Snapshot failed:', response.status, body)
    return res.status(500).json({ error: 'Snapshot failed', detail: body })
  }

  const rows = await response.json()
  console.log(`ELO snapshot complete — ${rows} rows written`)
  return res.status(200).json({ ok: true, rows })
}
