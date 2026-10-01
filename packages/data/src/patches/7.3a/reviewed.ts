import type { ReviewedEntry } from '../overlay'

// Flagged entries checked for patch 7.3a and found unaffected: their source changed, but
// nothing this repo models did. Each clears that entry's stale flag.
export const REVIEWED: ReviewedEntry[] = []
