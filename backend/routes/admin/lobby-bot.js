const { createClient } = require('@supabase/supabase-js')
const { randomBytes } = require('node:crypto')

function adminBotsEnabled() {
  if (process.env.ADMIN_BOT_API_ENABLED === 'true') return true
  if (process.env.NODE_ENV === 'production') return false
  return true
}

/**
 * POST /api/admin/lobby-bot
 * Authorization: Bearer <access_token>
 * Body: { lobbyId: string, displayName?: string }
 */
module.exports = async function postAdminLobbyBot(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!adminBotsEnabled()) {
    return res.status(403).json({
      message:
        'Admin bot API disabled. Set ADMIN_BOT_API_ENABLED=true to enable in production.',
    })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({
      message:
        'Missing SUPABASE_URL (or VITE_SUPABASE_URL), anon key, or SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing Bearer access token' })
  }

  const jwt = authHeader.slice('Bearer '.length).trim()
  if (!jwt) {
    return res.status(401).json({ message: 'Empty access token' })
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)

  if (userErr || !user) {
    return res.status(401).json({ message: userErr?.message ?? 'Invalid session' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const lobbyId = body.lobbyId
  const displayName = body.displayName

  if (!lobbyId || typeof lobbyId !== 'string') {
    return res.status(400).json({ message: 'lobbyId required' })
  }

  const { data: profile, error: profErr } = await userClient
    .from('profiles')
    .select('app_role')
    .eq('id', user.id)
    .single()

  if (profErr || profile?.app_role !== 'admin') {
    return res.status(403).json({ message: 'Admin role required' })
  }

  const { data: lobby, error: lobErr } = await userClient
    .from('lobbies')
    .select('id, host_id, status')
    .eq('id', lobbyId)
    .single()

  if (lobErr || !lobby) {
    return res.status(400).json({ message: 'Lobby not found' })
  }

  if (lobby.host_id !== user.id) {
    return res.status(403).json({ message: 'Only the lobby host can add bots' })
  }

  if (lobby.status !== 'open') {
    return res.status(400).json({ message: 'Lobby is not open' })
  }

  const svc = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `bot+${randomBytes(16).toString('hex')}@bots.whacked.test`
  const password = randomBytes(24).toString('base64url')

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_test_bot: true },
  })

  if (createErr || !created.user) {
    return res.status(500).json({
      message: createErr?.message ?? 'Failed to create bot user',
    })
  }

  const botId = created.user.id
  const name =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim().slice(0, 80)
      : 'Bot'

  const { error: updErr } = await svc
    .from('profiles')
    .update({
      is_test_bot: true,
      bot_created_by: user.id,
      display_name: name,
    })
    .eq('id', botId)

  if (updErr) {
    return res.status(500).json({
      message: `Bot created but profile update failed: ${updErr.message}`,
      botUserId: botId,
    })
  }

  const { error: rpcErr } = await userClient.rpc('admin_attach_bot_to_lobby', {
    p_lobby_id: lobbyId,
    p_bot_user_id: botId,
    p_display_name: name,
  })

  if (rpcErr) {
    return res.status(500).json({
      message: rpcErr.message,
      botUserId: botId,
    })
  }

  return res.status(200).json({ botUserId: botId, displayName: name })
}
