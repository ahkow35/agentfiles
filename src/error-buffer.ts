export class ErrorBuffer {
  private _errors: string[] = []
  private readonly capacity: number

  constructor(capacity = 50) {
    this.capacity = capacity
  }

  add(message: string): void {
    if (this._errors.length >= this.capacity) {
      this._errors.shift()
    }
    this._errors.push(message)
    console.warn(`[agentfiles] ${message}`)
  }

  get errors(): readonly string[] {
    return this._errors
  }

  get isEmpty(): boolean {
    return this._errors.length === 0
  }

  flush(): string[] {
    const copy = [...this._errors]
    this._errors = []
    return copy
  }

  summary(): string {
    const n = this._errors.length
    return n === 1
      ? this._errors[0]
      : `${n} skill file errors. Check developer console (Ctrl+Shift+I) for details.`
  }
}
