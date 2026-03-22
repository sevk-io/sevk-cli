import { defineCommand } from 'citty'
import render from './render'
import variables from './variables'

export default defineCommand({
  meta: { name: 'markup', description: 'Work with sevk email markup' },
  subCommands: { render, variables },
})
