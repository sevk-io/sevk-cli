export const ACTIVITY_ACTIONS = [
  'REQUESTED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'CLICKED',
  'BOUNCED',
  'COMPLAINT',
  'FAILED',
  'SUBSCRIBED',
  'UNSUBSCRIBED',
  'DELAYED',
  'REJECTED'
] as const

export type ActivityAction = typeof ACTIVITY_ACTIONS[number]

export const parseActivityActionList = (value: string): ActivityAction[] => {
  const actions = value.split(',').map(action => action.trim().toUpperCase())
  if (
    actions.length === 0 ||
    actions.some(action => !action || !(ACTIVITY_ACTIONS as readonly string[]).includes(action))
  ) {
    throw new Error(`--type must contain only: ${ACTIVITY_ACTIONS.join(', ')}`)
  }
  return actions as ActivityAction[]
}
