import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import send from './send'
import update from './update'
import del from './delete'
import analytics from './analytics'
import cancel from './cancel'
import test from './test'
import status from './status'
import emails from './emails'
import estimateCost from './estimate-cost'
import active from './active'

export default defineCommand({
  meta: { name: 'broadcasts', description: 'Manage broadcasts' },
  subCommands: { list, create, get, send, update, delete: del, analytics, cancel, test, status, emails, 'estimate-cost': estimateCost, active },
})
