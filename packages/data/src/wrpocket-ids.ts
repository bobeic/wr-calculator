/** wrpocket ids that differ from this repo's ids. */
export const ID_ALIASES: Record<string, string> = {
  'b.-f.-sword': 'bf-sword',
  'nunu-and-willump': 'nunu-willump',
}

/** Maps a wrpocket id to this repo's id. */
export function normalizeId(id: string): string {
  return ID_ALIASES[id] ?? id
}
