/** The official notes page URL for a patch id, e.g. 7.3a -> .../wild-rift-patch-notes-7-3a/. */
export function notesUrl(patch: string): string {
  return `https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-${patch.replace(/\./g, '-')}/`
}
