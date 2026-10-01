// Links from hand-modelled champion numbers to the wrpocket scaling rows they come from (per-rank tables such as
// q.scaling.强化伤害 = '60/80/100/120'). Row keys are the diff's field names: '<slot>.scaling.<type>', with '#2' on a
// repeated type. The patch pipeline applies a linked row change without a hand-written override; see
// docs/superpowers/specs/2026-10-01-source-sync-design.md §4. test/champion-links.test.ts checks every link.

export type ChampionValue = number | { byRank: number[] }

export interface ChampionLink {
  /** Path inside the champion, e.g. 'abilities.q.damage[0].base'. */
  path: string
  row: string
  /** The model value from the row's per-rank numbers (percent signs dropped); defaults to { byRank }. */
  value?: (ranks: number[]) => ChampionValue
}

export interface ChampionLinks {
  links: ChampionLink[]
  /** Rows the model doesn't use (other targets, healing, damage reduction); a change to them changes nothing. */
  ignore: string[]
}

const pctByRank = (ranks: number[]): ChampionValue => ({ byRank: ranks.map((rank) => rank / 100) })
const flat = (ranks: number[]): ChampionValue => ranks[0]

export const CHAMPION_LINKS: Record<string, ChampionLinks> = {
  ambessa: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.Resource', value: flat },
      // The modelled Q is Cunning Sweep's edge hit; the stage is Sundering Slam's first target.
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.强化伤害' },
      { path: 'abilities.q.damage[0].ratios[1].value', row: 'q.scaling.暗袭-边缘伤害丨目标最大生命值', value: pctByRank },
      { path: 'abilities.q.stages[0].damage[0].base', row: 'q.scaling.强化伤害#2' },
      { path: 'abilities.q.stages[0].damage[0].ratios[1].value', row: 'q.scaling.裂斩-首名目标丨目标最大生命值', value: pctByRank },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd' },
      { path: 'abilities.w.cost', row: 'w.scaling.Resource', value: flat },
      { path: 'abilities.w.damage[0].base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.Resource', value: flat },
      { path: 'abilities.e.damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.e.damage[0].ratios[0].value', row: 'e.scaling.攻击系数', value: pctByRank },
      { path: 'abilities.e.stages[0].damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.e.stages[0].damage[0].ratios[0].value', row: 'e.scaling.攻击系数', value: pctByRank },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
      { path: 'abilities.r.effects[0].amount', row: 'r.scaling.护甲穿透', value: pctByRank },
    ],
    ignore: [
      // Cunning Sweep's center hit and Sundering Slam's other targets (the model uses the edge and first target).
      'q.scaling.基础伤害', 'q.scaling.基础伤害#2', 'q.scaling.暗袭-链刃伤害丨目标最大生命值', 'q.scaling.裂斩-其他目标丨目标最大生命值',
      // W's empowered shockwave after blocking damage isn't modelled.
      'w.scaling.强化伤害',
      // R's damage reduction and healing protect Ambessa; the model is one-on-one damage dealt.
      'r.scaling.伤害减免', 'r.scaling.技能伤害回复',
    ],
  },
}
