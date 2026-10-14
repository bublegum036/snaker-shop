export function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647
}
