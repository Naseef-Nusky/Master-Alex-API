import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import sgMail from '@sendgrid/mail'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const apiKey = process.env.SENDGRID_API_KEY
const fromEmail = process.env.SENDGRID_FROM_EMAIL
const toEmail = process.env.CONTACT_TO_EMAIL
const fromName = process.env.SENDGRID_FROM_NAME || 'Master Alex'

if (!apiKey || !fromEmail || !toEmail) {
  console.error('Missing SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, or CONTACT_TO_EMAIL in .env')
  process.exit(1)
}

sgMail.setApiKey(apiKey)

const msg = {
  to: toEmail.split(',').map((e) => e.trim()).filter(Boolean),
  from: { email: fromEmail, name: fromName },
  subject: 'Master Alex — test email from API',
  text: 'If you received this, SendGrid delivery to your inbox is working.',
  html: '<p>If you received this, <strong>SendGrid delivery</strong> to your inbox is working.</p>',
  mailSettings: {
    bypassListManagement: { enable: true },
  },
}

try {
  const [response] = await sgMail.send(msg)
  console.log('Test email sent successfully.')
  console.log('To:', toEmail)
  console.log('From:', `${fromName} <${fromEmail}>`)
  console.log('Message ID:', response?.headers?.['x-message-id'] || 'n/a')
  console.log('\nIf you do not see the email within 5 minutes:')
  console.log('1. Check Spam / Junk folder')
  console.log('2. Open SendGrid → Activity — confirm it was Delivered (not Bounced)')
  console.log('3. Ensure info@masteralex.co.uk is a real mailbox (not only a SendGrid sender)')
  if (fromEmail === toEmail) {
    console.log('4. FROM and TO are the same — authenticate masteralex.co.uk in SendGrid and use noreply@ as FROM')
  }
} catch (error) {
  console.error('Send failed:', JSON.stringify(error?.response?.body || error.message, null, 2))
  process.exit(1)
}
