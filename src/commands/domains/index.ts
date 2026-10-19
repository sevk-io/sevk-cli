import { defineCommand } from 'citty'

import create from './create'
import del from './delete'
import dnsRecords from './dns-records'
import get from './get'
import list from './list'
import regions from './regions'
import update from './update'
import verify from './verify'
import verifyInbound from './verify-inbound'

export default defineCommand({
  meta: { name: 'domains', description: 'Manage sending domains' },
  subCommands: { list, create, get, update, verify, 'verify-inbound': verifyInbound, delete: del, regions, 'dns-records': dnsRecords }
})
