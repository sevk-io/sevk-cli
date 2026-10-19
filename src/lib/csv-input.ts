export const parseCsv = (raw: string): Array<Record<string, string>> => {
  let delimiter = ','
  let quoted = false

  for (const character of raw) {
    if (character === '"') quoted = !quoted
    else if (!quoted && (character === ',' || character === ';')) {
      delimiter = character
      break
    } else if (!quoted && (character === '\r' || character === '\n')) break
  }

  const records: string[][] = []
  let fields: string[] = []
  let current = ''
  let inQuotes = false
  const finishRecord = () => {
    fields.push(current.trim())
    if (fields.some(field => field.length > 0)) records.push(fields)
    fields = []
    current = ''
  }

  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]

    if (character === '"') {
      if (inQuotes && raw[index + 1] === '"') {
        current += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      finishRecord()
      if (character === '\r' && raw[index + 1] === '\n') index++
    } else {
      current += character
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.')
  finishRecord()

  const headers = (records.shift() ?? []).map(header => {
    const normalized = header.toLowerCase()
    return normalized === 'email' || normalized === 'subscribed' ? normalized : header
  })

  return records.map((values, index) => {
    if (values.length > headers.length) {
      throw new Error(`CSV row ${index + 2} contains more fields than the header.`)
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']))
  })
}
