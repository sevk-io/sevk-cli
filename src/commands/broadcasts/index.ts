import { defineCommand } from 'citty'

import active from './active'
import analytics from './analytics'
import cancel from './cancel'
import create from './create'
import del from './delete'
import emails from './emails'
import estimateCost from './estimate-cost'
import estimateRecipients from './estimate-recipients'
import get from './get'
import list from './list'
import send from './send'
import status from './status'
import test from './test'
import update from './update'

export default defineCommand({
  meta: { name: 'broadcasts', description: 'Manage broadcasts' },
  subCommands: {
    list,
    create,
    get,
    send,
    update,
    delete: del,
    analytics,
    cancel,
    test,
    status,
    emails,
    'estimate-cost': estimateCost,
    'estimate-recipients': estimateRecipients,
    active
  }
})
