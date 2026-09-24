import type { Provenance } from '@wr-calc/schema'

/** Every patch-7.3 skeleton is unverified until the user checks it in-game. */
export const PATCH_7_3_PROVENANCE: Provenance = {
  source: 'manual', patch: '7.3', verifiedInGame: false,
}

/** Every value imported from (or hand-filled from) wrpocket.app for patch 7.3; unverified until checked in-game. */
export const WRPOCKET_7_3_PROVENANCE: Provenance = {
  source: 'wiki', patch: '7.3', verifiedInGame: false,
}
