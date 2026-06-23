import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import sgMail from '@sendgrid/mail'

const app = express()
const PORT = process.env.PORT || 3001

const requiredEnv = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'CONTACT_TO_EMAIL']
const missingEnv = requiredEnv.filter((key) => !process.env[key])
if (missingEnv.length) {
  console.warn(`Warning: missing env vars: ${missingEnv.join(', ')}`)
}

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(express.json({ limit: '32kb' }))

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
  }),
)

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
})

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    sendgridConfigured: Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL),
  })
})

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL || !process.env.CONTACT_TO_EMAIL) {
      res.status(503).json({ error: 'Email service is not configured.' })
      return
    }

    const { name, email, phone, message, date, source, page, website } = req.body || {}

    if (website) {
      res.status(400).json({ error: 'Invalid submission.' })
      return
    }

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Please fill in all required fields.' })
      return
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' })
      return
    }

    const trimmed = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      message: message.trim(),
      date: date?.trim() || '',
      source: (source || 'website').trim(),
      page: (page || 'Unknown page').trim(),
    }

    const subject = `New enquiry from ${trimmed.name} — ${trimmed.page}`
    const text = [
      'New contact form submission',
      '',
      `Source: ${trimmed.source}`,
      `Page: ${trimmed.page}`,
      `Name: ${trimmed.name}`,
      `Email: ${trimmed.email}`,
      `Phone: ${trimmed.phone}`,
      trimmed.date ? `Preferred date: ${trimmed.date}` : null,
      '',
      'Message:',
      trimmed.message,
    ]
      .filter(Boolean)
      .join('\n')

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Source:</strong> ${escapeHtml(trimmed.source)}</p>
      <p><strong>Page:</strong> ${escapeHtml(trimmed.page)}</p>
      <p><strong>Name:</strong> ${escapeHtml(trimmed.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(trimmed.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(trimmed.phone)}</p>
      ${trimmed.date ? `<p><strong>Preferred date:</strong> ${escapeHtml(trimmed.date)}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(trimmed.message).replace(/\n/g, '<br>')}</p>
    `

    await sgMail.send({
      to: process.env.CONTACT_TO_EMAIL,
      from: process.env.SENDGRID_FROM_EMAIL,
      replyTo: trimmed.email,
      subject,
      text,
      html,
    })

    res.json({ ok: true, message: 'Message sent successfully.' })
  } catch (error) {
    console.error('Contact form error:', error?.response?.body || error)
    res.status(500).json({ error: 'Failed to send message. Please try again or call us directly.' })
  }
})

app.use((err, _req, res, next) => {
  if (err?.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'Request not allowed.' })
    return
  }
  next(err)
})

app.listen(PORT, () => {
  console.log(`Master Alex API listening on port ${PORT}`)
})
