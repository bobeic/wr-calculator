import type { Provenance, Target } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export interface TargetPreset {
  id: string
  name: string
  provenance: Provenance
  target: Extract<Target, { kind: 'dummy' }>
}

// Placeholder hp/armor/mr: rough guesses, to be replaced during the in-game data-entry pass.
export const PATCH_7_3_TARGETS: TargetPreset[] = [
  {
    id: 'squishy', name: 'Squishy', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 1800, armor: 60, mr: 45 },
  },
  {
    id: 'bruiser', name: 'Bruiser', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 3000, armor: 110, mr: 70 },
  },
  {
    id: 'tank', name: 'Tank', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 4200, armor: 180, mr: 110 },
  },
]
