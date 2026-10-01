import { describe, it, expect } from 'vitest'
import { ProvenanceSchema } from '../src/provenance'

describe('ProvenanceSchema staleSince', () => {
  it('is optional and accepts a patch id', () => {
    expect(ProvenanceSchema.parse({ source: 'wiki', patch: '7.3', verifiedInGame: false })).not.toHaveProperty('staleSince')
    expect(ProvenanceSchema.parse({ source: 'wiki', patch: '7.3', verifiedInGame: false, staleSince: '7.3a' }).staleSince).toBe('7.3a')
  })
})
