export const WEBHOOK_EVENT_TYPES = [
  'email.sent',
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'email.rejected',
  'email.delayed',
  'email.rendering_failed',
  'contact.subscribed',
  'contact.unsubscribed',
  'broadcast.started',
  'broadcast.finished',
  'email.received'
] as const

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

const webhookEventTypes = new Set<string>(WEBHOOK_EVENT_TYPES)

export const parseWebhookEventList = (value: string): WebhookEventType[] => {
  const events = value.split(',').map(event => event.trim())
  if (events.length === 0 || events.some(event => event.length === 0)) {
    throw new TypeError('Webhook events must contain at least one event')
  }

  const invalid = events.find(event => !webhookEventTypes.has(event))
  if (invalid) {
    throw new TypeError(`Unsupported webhook event: ${invalid}`)
  }

  return events as WebhookEventType[]
}
