import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import sgMail from '@sendgrid/mail'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

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

const isProduction = process.env.NODE_ENV === 'production'

function isLocalDevOrigin(origin) {
  if (!origin) return false
  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch {
    return false
  }
}

app.use(express.json({ limit: '32kb' }))

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && isLocalDevOrigin(origin))
      ) {
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

function parseEmailList(value) {
  return (value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function getFromAddress() {
  return {
    email: process.env.SENDGRID_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME || 'Master Alex',
  }
}

function getToAddresses() {
  const recipients = parseEmailList(process.env.CONTACT_TO_EMAIL)
  const bcc = parseEmailList(process.env.CONTACT_BCC_EMAIL)
  return { to: recipients, bcc }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getSendGridErrorMessage(error) {
  const errors = error?.response?.body?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((e) => e.message).join(' ')
  }
  return error?.message || 'Unknown SendGrid error'
}

app.get('/api/health', (_req, res) => {
  const { to } = getToAddresses()
  res.json({
    ok: true,
    sendgridConfigured: Boolean(
      process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL && to.length > 0,
    ),
    from: process.env.SENDGRID_FROM_EMAIL || null,
    to,
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

    const { to, bcc } = getToAddresses()
    if (to.length === 0) {
      res.status(503).json({ error: 'Email service is not configured.' })
      return
    }

    const subject = `Master Alex — New enquiry from ${trimmed.name}`
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
      '',
      '---',
      `Reply to customer: ${trimmed.email}`,
      `Call customer: ${trimmed.phone}`,
    ]
      .filter(Boolean)
      .join('\n')

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Source:</strong> ${escapeHtml(trimmed.source)}</p>
      <p><strong>Page:</strong> ${escapeHtml(trimmed.page)}</p>
      <p><strong>Name:</strong> ${escapeHtml(trimmed.name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(trimmed.email)}">${escapeHtml(trimmed.email)}</a></p>
      <p><strong>Phone:</strong> <a href="tel:${escapeHtml(trimmed.phone.replace(/\s/g, ''))}">${escapeHtml(trimmed.phone)}</a></p>
      ${trimmed.date ? `<p><strong>Preferred date:</strong> ${escapeHtml(trimmed.date)}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(trimmed.message).replace(/\n/g, '<br>')}</p>
      <p style="margin-top:24px;padding:12px;background:#f4f4f5;border-radius:8px;">
        <strong>Reply to customer:</strong>
        <a href="mailto:${escapeHtml(trimmed.email)}">${escapeHtml(trimmed.email)}</a>
      </p>
    `

    const fromEmail = process.env.SENDGRID_FROM_EMAIL.toLowerCase()
    const isSelfInbox = to.every((addr) => addr.toLowerCase() === fromEmail)

    const mail = {
      to,
      from: getFromAddress(),
      subject,
      text,
      html,
      mailSettings: {
        bypassListManagement: { enable: true },
      },
    }

    // Outlook often hides self-sent mail when Reply-To differs from From — skip Reply-To in that case
    if (!isSelfInbox) {
      mail.replyTo = { email: trimmed.email, name: trimmed.name }
    }

    if (bcc.length > 0) {
      mail.bcc = bcc
    }

    const [response] = await sgMail.send(mail)
    const messageId = response?.headers?.['x-message-id']
    if (messageId) {
      console.log(`Contact email sent (${messageId}) → ${to.join(', ')}`)
    }

    res.json({ ok: true, message: 'Message sent successfully.' })
  } catch (error) {
    const detail = getSendGridErrorMessage(error)
    console.error('Contact form error:', error?.response?.body || error)
    res.status(500).json({
      error: isProduction
        ? 'Failed to send message. Please try again or call us directly.'
        : `Failed to send message: ${detail}`,
    })
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
  const { to } = getToAddresses()
  const configured = Boolean(
    process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL && to.length > 0,
  )
  console.log(`Master Alex API listening on port ${PORT}`)
  console.log(`SendGrid configured: ${configured}`)
  if (configured) {
    console.log(`Form emails: ${process.env.SENDGRID_FROM_EMAIL} → ${to.join(', ')}`)
    if (process.env.SENDGRID_FROM_EMAIL === process.env.CONTACT_TO_EMAIL) {
      console.warn(
        'FROM and TO are the same address. Check Spam folder, or authenticate masteralex.co.uk in SendGrid and use noreply@masteralex.co.uk as SENDGRID_FROM_EMAIL.',
      )
    }
  }
  if (!configured) {
    console.warn(`Missing env: ${requiredEnv.filter((key) => !process.env[key]).join(', ')}`)
  }
})
