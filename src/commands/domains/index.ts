import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import verify from './verify'
import del from './delete'
import regions from './regions'
import dnsRecords from './dns-records'

export default defineCommand({
  meta: { name: 'domains', description: 'Manage sending domains' },
  subCommands: { list, create, get, update, verify, delete: del, regions, 'dns-records': dnsRecords },
})
