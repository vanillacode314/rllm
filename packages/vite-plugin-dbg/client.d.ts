declare global {
  const dbg$: {
    (): void
    <const T>(value: T): T
    <const T extends unknown[]>(...values: T): T
  }
}

export {}
