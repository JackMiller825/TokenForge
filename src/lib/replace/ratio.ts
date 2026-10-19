export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function aspectLabel(width?: number, height?: number): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

export function aspectValue(width?: number, height?: number): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return width / height;
}

export function aspectDelta(left?: number, right?: number, leftHeight?: number, rightHeight?: number): number | null {
  const a = aspectValue(left, leftHeight);
  const b = aspectValue(right, rightHeight);
  if (a == null || b == null) return null;
  return Math.abs(a - b) / Math.max(a, b);
}

export function aspectsCompatible(delta: number | null, tolerance = 0.08): boolean {
  return delta != null && delta <= tolerance;
}
