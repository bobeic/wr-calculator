// Which champions attack at range. Neither wrpocket nor Tencent's feed says, so this is hand-written (2026-10-03) from
// each champion's League of Legends attack type, which Wild Rift keeps. Unverified in game: skim it and correct any
// champion that's wrong. Everyone not listed is melee.
export const RANGED_CHAMPIONS: ReadonlySet<string> = new Set([
  'ahri', 'akshan', 'annie', 'ashe', 'aurelion-sol', 'aurora', 'bard', 'brand', 'caitlyn', 'corki', 'draven', 'ezreal',
  'fiddlesticks', 'gnar', 'graves', 'heimerdinger', 'hwei', 'janna', 'jhin', 'jinx', 'kaisa', 'kalista', 'karma',
  'kennen', 'kindred', 'kogmaw', 'lissandra', 'lucian', 'lulu', 'lux', 'mel', 'milio', 'miss-fortune', 'morgana',
  'nami', 'nidalee', 'norra', 'orianna', 'rakan', 'ryze', 'samira', 'senna', 'seraphine', 'sivir', 'smolder', 'sona',
  'soraka', 'swain', 'syndra', 'taliyah', 'teemo', 'thresh', 'tristana', 'twisted-fate', 'twitch', 'urgot', 'varus',
  'vayne', 'veigar', 'velkoz', 'vex', 'viktor', 'vladimir', 'xayah', 'yunara', 'yuumi', 'zeri', 'ziggs', 'zilean',
  'zoe', 'zyra',
])

// Champions whose attack type changes in game; the engine uses one value for the whole combo. Listed as:
// - gnar: ranged (Mini Gnar); Mega Gnar is melee.
// - nidalee: ranged (human form); Cougar is melee.
// - jayce: melee (starts in Hammer stance); Cannon stance is ranged.
// - kayle: melee; League's Kayle turns ranged at level 6, Wild Rift's timing is unverified.
export const FORM_DEPENDENT_CHAMPIONS = ['gnar', 'nidalee', 'jayce', 'kayle'] as const

/** A champion's attack type by our id (melee unless listed as ranged). */
export function attackTypeOf(championId: string): 'melee' | 'ranged' {
  return RANGED_CHAMPIONS.has(championId) ? 'ranged' : 'melee'
}
