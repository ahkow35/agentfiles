// Minimal obsidian mock for unit tests.
// Only implements the functions used by scanner.ts.

export function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/)
    if (match) {
      const key = match[1]
      const value = match[2].trim()
      // Strip surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        result[key] = value.slice(1, -1)
      } else {
        result[key] = value
      }
    }
  }
  if (Object.keys(result).length === 0 && yaml.trim().length > 0) {
    // Treat as malformed if no keys parsed but content exists with invalid chars
    if (/:::/.test(yaml)) {
      throw new Error('Invalid YAML')
    }
  }
  return result
}
