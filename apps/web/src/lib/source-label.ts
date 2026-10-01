import type { DamageInstance } from '@wr-calc/calc'

/** Names an instance's source, listing the raw parts when several sources merged into one hit. */
export function sourceLabel(instance: DamageInstance, format: (value: number) => string): string {
  if (!instance.parts || instance.parts.length < 2) return instance.source.name
  const parts = instance.parts.map((part) => `${part.source.name} ${format(part.amount)}`).join(' + ')
  return `${instance.source.name} (${parts})`
}
