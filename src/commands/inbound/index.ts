import { defineCommand } from 'citty'

import blocklist from './blocklist/index'
import del from './delete'
import download from './download'
import get from './get'
import list from './list'
import quota from './quota/index'
import routes from './routes/index'
import security from './security/index'
import stats from './stats'

export default defineCommand({
  meta: { name: 'inbound', description: 'Manage incoming email' },
  subCommands: {
    list,
    get,
    delete: del,
    stats,
    download,
    routes,
    blocklist,
    quota,
    security
  }
})
