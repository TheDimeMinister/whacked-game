require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')

const PORT = Number(process.env.PORT) || 3000

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]
const origins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultOrigins

const app = express()

app.use(
  cors({
    origin: origins,
    credentials: true,
  }),
)
app.use(express.json())

// Visiting the bare Render URL (/) shows something helpful; health for monitors is /api/health
app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Whacked API — open GET /api/health for the health check',
  })
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/admin/lobby-bot', require('./routes/admin/lobby-bot'))
app.post('/api/stripe/checkout', require('./routes/stripe/checkout'))
app.post('/api/stripe/webhook', require('./routes/stripe/webhook'))

app.listen(PORT, () => {
  console.log(`Whacked API listening on http://127.0.0.1:${PORT}`)
  console.log(`CORS origins: ${origins.join(', ')}`)
})
