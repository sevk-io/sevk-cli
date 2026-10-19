import { defineCommand } from 'citty'

import addContact from './add-contact'
import create from './create'
import del from './delete'
import get from './get'
import list from './list'
import listContacts from './list-contacts'
import removeContact from './remove-contact'
import update from './update'

export default defineCommand({
  meta: { name: 'topics', description: 'Manage email topics' },
  subCommands: { list, create, get, update, delete: del, 'add-contact': addContact, 'remove-contact': removeContact, 'list-contacts': listContacts }
})
