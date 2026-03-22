import { describe, it, expect, beforeAll } from 'bun:test'
import { SevkClient } from '../src/lib/client'
import { validateKeyFormat, maskKey } from '../src/lib/config'

const API_KEY = process.env.SEVK_TEST_API_KEY || ''
const BASE_URL = process.env.SEVK_TEST_BASE_URL || 'https://api.sevk.io'
const skipIntegration = !API_KEY

// ============================================================================
// Config & Auth Utils
// ============================================================================

describe('Config Utils', () => {
  it('should validate correct API key format', () => {
    expect(validateKeyFormat('sevk_abc1234567')).toBeNull()
  })

  it('should reject empty key', () => {
    expect(validateKeyFormat('')).toBe('API key is required')
  })

  it('should reject key without sevk_ prefix', () => {
    expect(validateKeyFormat('invalid_key')).toBe('API key must start with "sevk_"')
  })

  it('should reject short key', () => {
    expect(validateKeyFormat('sevk_ab')).toBe('API key is too short')
  })

  it('should mask key correctly', () => {
    const masked = maskKey('sevk_full_abcdefghij1234567890')
    expect(masked).toContain('sevk_f')
    expect(masked).toContain('...')
  })

  it('should mask short key', () => {
    expect(maskKey('short')).toBe('***')
  })
})

// ============================================================================
// API Client
// ============================================================================

describe('SevkClient', () => {
  it('should create client with defaults', () => {
    expect(new SevkClient('sevk_test')).toBeDefined()
  })

  it('should create client with custom base URL', () => {
    expect(new SevkClient('sevk_test', 'http://localhost:4000')).toBeDefined()
  })
})

// ============================================================================
// Integration: Domains (list, get, regions, dns-records, update)
// ============================================================================

describe.if(!skipIntegration)('API: Domains', () => {
  let client: SevkClient
  let domainId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list domains', async () => {
    const r = await client.get<any>('/domains')
    expect(r.items).toBeDefined()
    expect(Array.isArray(r.items)).toBe(true)
    if (r.items.length) domainId = r.items[0].id
  })

  it('should get a domain', async () => {
    if (!domainId) return
    const r = await client.get<any>(`/domains/${domainId}`)
    expect(r.id).toBe(domainId)
  })

  it('should get domain DNS records', async () => {
    if (!domainId) return
    const r = await client.get<any>(`/domains/${domainId}/dns-records`)
    expect(r.items).toBeDefined()
    expect(Array.isArray(r.items)).toBe(true)
  })

  it('should get regions', async () => {
    const r = await client.get<any>('/domains/regions')
    expect(r).toBeDefined()
  })

  it('should update a domain', async () => {
    if (!domainId) return
    const r = await client.put<any>(`/domains/${domainId}`, { clickTracking: true })
    expect(r.id).toBe(domainId)
  })

})

// ============================================================================
// Integration: Contacts (full CRUD + events + bulk-update)
// ============================================================================

describe.if(!skipIntegration)('API: Contacts', () => {
  let client: SevkClient
  let contactId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list contacts', async () => {
    const r = await client.get<any>('/contacts')
    expect(r.items).toBeDefined()
  })

  it('should create a contact', async () => {
    const r = await client.post<any>('/contacts', { email: `cli-${Date.now()}@test.com` })
    expect(r.id).toBeDefined()
    contactId = r.id
  })

  it('should get a contact', async () => {
    if (!contactId) return
    const r = await client.get<any>(`/contacts/${contactId}`)
    expect(r.id).toBe(contactId)
  })

  it('should update a contact', async () => {
    if (!contactId) return
    const r = await client.put<any>(`/contacts/${contactId}`, { firstName: 'CLITest' })
    expect(r).toBeDefined()
  })

  it('should get contact events', async () => {
    if (!contactId) return
    const r = await client.get<any>(`/contacts/${contactId}/events`)
    expect(r).toBeDefined()
  })

  it('should bulk update contacts', async () => {
    if (!contactId) return
    try {
      const r = await client.put<any>('/contacts/bulk-update', {
        contacts: [{ id: contactId, firstName: 'BulkTest' }]
      })
      expect(r).toBeDefined()
    } catch {
      // Bulk update might not be available, skip
    }
  })

  it('should delete a contact', async () => {
    if (!contactId) return
    await client.delete<any>(`/contacts/${contactId}`)
  })
})

// ============================================================================
// Integration: Audiences (full CRUD + contacts)
// ============================================================================

describe.if(!skipIntegration)('API: Audiences', () => {
  let client: SevkClient
  let audienceId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list audiences', async () => {
    const r = await client.get<any>('/audiences')
    expect(r.items).toBeDefined()
  })

  it('should create an audience', async () => {
    const r = await client.post<any>('/audiences', { name: `cli-${Date.now()}` })
    expect(r.id).toBeDefined()
    audienceId = r.id
  })

  it('should get an audience', async () => {
    if (!audienceId) return
    const r = await client.get<any>(`/audiences/${audienceId}`)
    expect(r.id).toBe(audienceId)
  })

  it('should list audience contacts', async () => {
    if (!audienceId) return
    const r = await client.get<any>(`/audiences/${audienceId}/contacts`)
    expect(r).toBeDefined()
  })

  it('should add contact to audience', async () => {
    if (!audienceId) return
    // Create a contact first, then add to audience
    const contact = await client.post<any>('/contacts', { email: `cli-aud-${Date.now()}@test.com` })
    const r = await client.post<any>(`/audiences/${audienceId}/contacts`, {
      contactIds: [contact.id]
    })
    expect(r).toBeDefined()
    await client.delete<any>(`/contacts/${contact.id}`)
  })

  it('should update an audience', async () => {
    if (!audienceId) return
    const r = await client.put<any>(`/audiences/${audienceId}`, { name: `cli-upd-${Date.now()}` })
    expect(r).toBeDefined()
  })

  it('should delete an audience', async () => {
    if (!audienceId) return
    await client.delete<any>(`/audiences/${audienceId}`)
  })
})

// ============================================================================
// Integration: Templates (full CRUD + duplicate)
// ============================================================================

describe.if(!skipIntegration)('API: Templates', () => {
  let client: SevkClient
  let templateId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list templates', async () => {
    const r = await client.get<any>('/templates')
    expect(r.items).toBeDefined()
  })

  it('should create a template', async () => {
    const r = await client.post<any>('/templates', { title: `cli-${Date.now()}`, content: '<p>t</p>' })
    expect(r.id).toBeDefined()
    templateId = r.id
  })

  it('should get a template', async () => {
    if (!templateId) return
    const r = await client.get<any>(`/templates/${templateId}`)
    expect(r.id).toBe(templateId)
  })

  it('should update a template', async () => {
    if (!templateId) return
    const r = await client.put<any>(`/templates/${templateId}`, { title: `cli-upd-${Date.now()}` })
    expect(r).toBeDefined()
  })

  it('should duplicate a template', async () => {
    if (!templateId) return
    const r = await client.post<any>(`/templates/${templateId}/duplicate`)
    expect(r.id).toBeDefined()
    if (r.id) await client.delete<any>(`/templates/${r.id}`)
  })

  it('should delete a template', async () => {
    if (!templateId) return
    await client.delete<any>(`/templates/${templateId}`)
  })
})

// ============================================================================
// Integration: Broadcasts (list, get, create, update, delete)
// ============================================================================

describe.if(!skipIntegration)('API: Broadcasts', () => {
  let client: SevkClient
  let broadcastId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list broadcasts', async () => {
    const r = await client.get<any>('/broadcasts', { limit: '2' })
    expect(r.items).toBeDefined()
    if (r.items.length) broadcastId = r.items[0].id
  })

  it('should get a broadcast', async () => {
    if (!broadcastId) return
    const r = await client.get<any>(`/broadcasts/${broadcastId}`)
    expect(r.id).toBe(broadcastId)
  })
})

// ============================================================================
// Integration: Topics (full CRUD)
// ============================================================================

describe.if(!skipIntegration)('API: Topics', () => {
  let client: SevkClient
  let audienceId: string
  let topicId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const r = await client.post<any>('/audiences', { name: `cli-topics-${Date.now()}` })
    audienceId = r.id
  })

  it('should list topics', async () => {
    const r = await client.get<any>(`/audiences/${audienceId}/topics`)
    expect(r).toBeDefined()
  })

  it('should create a topic', async () => {
    const r = await client.post<any>(`/audiences/${audienceId}/topics`, { name: `cli-topic-${Date.now()}` })
    expect(r.id).toBeDefined()
    topicId = r.id
  })

  it('should get a topic', async () => {
    if (!topicId || !audienceId) return
    const r = await client.get<any>(`/audiences/${audienceId}/topics/${topicId}`)
    expect(r.id).toBe(topicId)
  })

  it('should update a topic', async () => {
    if (!topicId || !audienceId) return
    const r = await client.put<any>(`/audiences/${audienceId}/topics/${topicId}`, { name: `cli-upd-${Date.now()}` })
    expect(r).toBeDefined()
  })

  it('should delete a topic', async () => {
    if (!topicId) return
    await client.delete<any>(`/audiences/${audienceId}/topics/${topicId}`)
  })

  // Cleanup audience
  it('cleanup', async () => {
    await client.delete<any>(`/audiences/${audienceId}`)
  })
})

// ============================================================================
// Integration: Segments (full CRUD + calculate)
// ============================================================================

describe.if(!skipIntegration)('API: Segments', () => {
  let client: SevkClient
  let audienceId: string
  let segmentId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const r = await client.post<any>('/audiences', { name: `cli-segs-${Date.now()}` })
    audienceId = r.id
  })

  it('should list segments', async () => {
    const r = await client.get<any>(`/audiences/${audienceId}/segments`)
    expect(r).toBeDefined()
  })

  it('should create a segment', async () => {
    const r = await client.post<any>(`/audiences/${audienceId}/segments`, {
      name: `cli-seg-${Date.now()}`,
      rules: [],
      operator: 'AND'
    })
    expect(r.id).toBeDefined()
    segmentId = r.id
  })

  it('should get a segment', async () => {
    if (!segmentId || !audienceId) return
    const r = await client.get<any>(`/audiences/${audienceId}/segments/${segmentId}`)
    expect(r.id).toBe(segmentId)
  })

  it('should update a segment', async () => {
    if (!segmentId || !audienceId) return
    const r = await client.put<any>(`/audiences/${audienceId}/segments/${segmentId}`, { name: `cli-upd-${Date.now()}` })
    expect(r).toBeDefined()
  })

  it('should calculate a segment', async () => {
    if (!segmentId) return
    const r = await client.get<any>(`/audiences/${audienceId}/segments/${segmentId}/calculate`)
    expect(r).toBeDefined()
  })

  it('should delete a segment', async () => {
    if (!segmentId || !audienceId) return
    await client.delete<any>(`/audiences/${audienceId}/segments/${segmentId}`)
  })

  it('cleanup', async () => {
    await client.delete<any>(`/audiences/${audienceId}`)
  })
})

// ============================================================================
// Integration: Emails (send, reject)
// ============================================================================

describe.if(!skipIntegration)('API: Emails', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should reject unverified domain', async () => {
    try {
      await client.post('/emails', { from: 'test@unverified.xyz', to: 'test@test.com', subject: 'Test', html: '<p>t</p>' })
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err.message.toLowerCase()).toContain('domain')
    }
  })
})

// ============================================================================
// Integration: Subscriptions (subscribe, unsubscribe)
// ============================================================================

describe.if(!skipIntegration)('API: Subscriptions', () => {
  let client: SevkClient
  let audienceId: string
  const subEmail = `cli-sub-${Date.now()}@test.com`

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const r = await client.get<any>('/audiences')
    if (r?.items?.length) audienceId = r.items[0].id
  })

  it('should subscribe a contact', async () => {
    if (!audienceId) return
    const r = await client.post<any>('/subscriptions/subscribe', { email: subEmail, audienceId })
    expect(r).toBeDefined()
  })

  it('should unsubscribe a contact', async () => {
    if (!audienceId) return
    const r = await client.post<any>('/subscriptions/unsubscribe', { email: subEmail, audienceId })
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Webhooks (full CRUD)
// ============================================================================

describe.if(!skipIntegration)('API: Webhooks', () => {
  let client: SevkClient
  let webhookId: string

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list webhooks', async () => {
    const r = await client.get<any>('/webhooks')
    expect(r).toBeDefined()
  })

  it('should create a webhook', async () => {
    const r = await client.post<any>('/webhooks', {
      url: 'https://example.com/cli-webhook-test',
      events: ['email.sent']
    })
    expect(r.id).toBeDefined()
    webhookId = r.id
  })

  it('should get a webhook', async () => {
    if (!webhookId) return
    const r = await client.get<any>(`/webhooks/${webhookId}`)
    expect(r.id).toBe(webhookId)
  })

  it('should update a webhook', async () => {
    if (!webhookId) return
    const r = await client.put<any>(`/webhooks/${webhookId}`, {
      url: 'https://example.com/cli-webhook-updated'
    })
    expect(r.id).toBe(webhookId)
  })

  it('should delete a webhook', async () => {
    if (!webhookId) return
    await client.delete<any>(`/webhooks/${webhookId}`)
  })
})

// ============================================================================
// Integration: Events
// ============================================================================

describe.if(!skipIntegration)('API: Events', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list events', async () => {
    const r = await client.get<any>('/events')
    expect(r).toBeDefined()
  })

  it('should get event stats', async () => {
    const r = await client.get<any>('/events/stats')
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Usage/Limits
// ============================================================================

describe.if(!skipIntegration)('API: Usage', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should get usage/limits', async () => {
    const r = await client.get<any>('/limits')
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Audiences - remove contact
// ============================================================================

describe.if(!skipIntegration)('API: Audiences Remove Contact', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should remove a contact from audience', async () => {
    const aud = await client.post<any>('/audiences', { name: `cli-rm-${Date.now()}` })
    const contact = await client.post<any>('/contacts', { email: `cli-rm-${Date.now()}@test.com` })
    await client.post<any>(`/audiences/${aud.id}/contacts`, { contactIds: [contact.id] })
    const r = await client.delete<any>(`/audiences/${aud.id}/contacts/${contact.id}`)
    expect(r).toBeDefined()
    await client.delete<any>(`/contacts/${contact.id}`)
    await client.delete<any>(`/audiences/${aud.id}`)
  })
})

// ============================================================================
// Integration: Topics - add/remove contact, list contacts
// ============================================================================

describe.if(!skipIntegration)('API: Topics Contacts', () => {
  let client: SevkClient
  let audienceId: string
  let topicId: string
  let contactId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const aud = await client.post<any>('/audiences', { name: `cli-tc-${Date.now()}` })
    audienceId = aud.id
    const topic = await client.post<any>(`/audiences/${audienceId}/topics`, { name: `cli-tc-topic-${Date.now()}` })
    topicId = topic.id
    const contact = await client.post<any>('/contacts', { email: `cli-tc-${Date.now()}@test.com` })
    contactId = contact.id
  })

  it('should add contact to topic', async () => {
    const r = await client.post<any>(`/audiences/${audienceId}/topics/${topicId}/contacts`, { contactIds: [contactId] })
    expect(r).toBeDefined()
  })

  it('should list contacts for topic', async () => {
    const r = await client.get<any>(`/audiences/${audienceId}/topics/${topicId}/contacts`)
    expect(r).toBeDefined()
  })

  it('should remove contact from topic', async () => {
    const r = await client.delete<any>(`/audiences/${audienceId}/topics/${topicId}/contacts/${contactId}`)
    expect(r).toBeDefined()
  })

  it('cleanup', async () => {
    await client.delete<any>(`/audiences/${audienceId}/topics/${topicId}`)
    await client.delete<any>(`/contacts/${contactId}`)
    await client.delete<any>(`/audiences/${audienceId}`)
  })
})

// ============================================================================
// Integration: Broadcasts - CRUD + status/analytics/cancel
// ============================================================================

describe.if(!skipIntegration)('API: Broadcasts Extended', () => {
  let client: SevkClient
  let broadcastId: string
  let audienceId: string
  let domainId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const domains = await client.get<any>('/domains')
    if (domains.items.length) domainId = domains.items[0].id
    const audiences = await client.get<any>('/audiences')
    if (audiences.items.length) audienceId = audiences.items[0].id
  })

  it('should create a broadcast', async () => {
    if (!domainId || !audienceId) return
    const r = await client.post<any>('/broadcasts', {
      name: `cli-bc-${Date.now()}`,
      subject: 'CLI Test',
      from: 'test',
      senderName: 'CLI Test',
      domainId,
      audienceId,
      style: 'HTML',
      body: '<p>Test</p>'
    })
    expect(r.id).toBeDefined()
    broadcastId = r.id
  })

  it('should update a broadcast', async () => {
    if (!broadcastId) return
    const r = await client.put<any>(`/broadcasts/${broadcastId}`, { subject: 'Updated' })
    expect(r).toBeDefined()
  })

  it('should get broadcast status', async () => {
    if (!broadcastId) return
    const r = await client.get<any>(`/broadcasts/${broadcastId}/status`)
    expect(r).toBeDefined()
  })

  it('should get broadcast analytics', async () => {
    if (!broadcastId) return
    const r = await client.get<any>(`/broadcasts/${broadcastId}/analytics`)
    expect(r).toBeDefined()
  })

  it('should get broadcast emails', async () => {
    if (!broadcastId) return
    const r = await client.get<any>(`/broadcasts/${broadcastId}/emails`)
    expect(r).toBeDefined()
  })

  it('should estimate broadcast cost', async () => {
    if (!broadcastId) return
    const r = await client.get<any>(`/broadcasts/${broadcastId}/estimate-cost`)
    expect(r).toBeDefined()
  })

  it('should delete a broadcast', async () => {
    if (!broadcastId) return
    await client.delete<any>(`/broadcasts/${broadcastId}`)
  })
})

// ============================================================================
// Integration: Segments - preview
// ============================================================================

describe.if(!skipIntegration)('API: Segments Preview', () => {
  let client: SevkClient
  let audienceId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const aud = await client.post<any>('/audiences', { name: `cli-sp-${Date.now()}` })
    audienceId = aud.id
  })

  it('should preview a segment', async () => {
    const r = await client.post<any>(`/audiences/${audienceId}/segments/preview`, {
      rules: [],
      operator: 'AND'
    })
    expect(r).toBeDefined()
  })

  it('cleanup', async () => {
    await client.delete<any>(`/audiences/${audienceId}`)
  })
})

// ============================================================================
// Integration: Contacts - import
// ============================================================================

describe.if(!skipIntegration)('API: Contacts Import', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should import contacts', async () => {
    const r = await client.post<any>('/contacts/import', {
      contacts: [{ email: `cli-import-${Date.now()}@test.com` }]
    })
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Domains - verify
// ============================================================================

describe.if(!skipIntegration)('API: Domains Verify', () => {
  let client: SevkClient
  let domainId: string

  beforeAll(async () => {
    client = new SevkClient(API_KEY, BASE_URL)
    const r = await client.get<any>('/domains')
    if (r.items.length) domainId = r.items[0].id
  })

  it('should verify a domain', async () => {
    if (!domainId) return
    try {
      const r = await client.post<any>(`/domains/${domainId}/verify`)
      expect(r).toBeDefined()
    } catch {
      // Already verified domains may return error
    }
  })
})

// ============================================================================
// Integration: Webhooks - events list, test
// ============================================================================

describe.if(!skipIntegration)('API: Webhooks Extended', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list webhook events', async () => {
    const r = await client.get<any>('/webhooks/events')
    expect(r).toBeDefined()
  })

  it('should test a webhook', async () => {
    const created = await client.post<any>('/webhooks', {
      url: 'https://example.com/cli-wh-test',
      events: ['email.sent']
    })
    if (!created.id) return
    try {
      const r = await client.post<any>(`/webhooks/${created.id}/test`)
      expect(r).toBeDefined()
    } catch {
      // Test may fail if URL is unreachable
    }
    await client.delete<any>(`/webhooks/${created.id}`)
  })
})

// ============================================================================
// Integration: Broadcasts - active list
// ============================================================================

describe.if(!skipIntegration)('API: Broadcasts Active', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should list active broadcasts', async () => {
    const r = await client.get<any>('/broadcasts/active')
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Doctor
// ============================================================================

describe.if(!skipIntegration)('API: Doctor', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should check API connectivity', async () => {
    const r = await client.get<any>('/domains')
    expect(r).toBeDefined()
  })
})

// ============================================================================
// Integration: Error Handling
// ============================================================================

describe.if(!skipIntegration)('API: Error Handling', () => {
  let client: SevkClient

  beforeAll(() => { client = new SevkClient(API_KEY, BASE_URL) })

  it('should throw on invalid API key', async () => {
    const bad = new SevkClient('sevk_invalid_key', BASE_URL)
    try {
      await bad.get('/domains')
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err.message.toLowerCase()).toContain('invalid')
    }
  })

  it('should throw on not found', async () => {
    try {
      await client.get('/contacts/non-existent-id-12345')
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err.message.toLowerCase()).toContain('not found')
    }
  })
})
