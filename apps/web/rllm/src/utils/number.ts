export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function formatToPercentage(a: number, b: number, precision: number = 0) {
  return b === 0 ? '0%' : `${((a / b) * 100).toFixed(precision)}%`;
}

export function formatToTokens(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1) + 'B';
  }
  if (abs >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + 'M';
  }
  if (abs >= 1_000) {
    return (n / 1_000).toFixed(1) + 'K';
  }
  return n.toFixed(1);
}
