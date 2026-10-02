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
  darius: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP' },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.q.damage[0].ratios[0].value', row: 'q.scaling.攻击系数', value: pctByRank },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd', value: flat },
      { path: 'abilities.w.cost', row: 'w.scaling.MP', value: flat },
      { path: 'abilities.w.effects[0].bonus.ratios[0].value', row: 'w.scaling.攻击系数', value: pctByRank },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP', value: flat },
      { path: 'abilities.e.effects[0].amount', row: 'e.scaling.护甲穿透', value: pctByRank },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP' },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
    ],
    ignore: [],
  },
  'lee-sin': {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.Resource', value: flat },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.q.stages[0].damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.q.stages[0].damage[0].ratios[1].value', row: 'q.scaling.基础伤害' },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd' },
      { path: 'abilities.w.cost', row: 'w.scaling.Resource', value: flat },
      { path: 'abilities.w.effects[0].bonus.base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd', value: flat },
      { path: 'abilities.e.cost', row: 'e.scaling.Resource', value: flat },
      { path: 'abilities.e.damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
      { path: 'abilities.r.damage[0].ratios[1].value', row: 'r.scaling.伤害比例', value: pctByRank },
    ],
    // Safeguard's shield, Iron Will's vamp and Cripple's slow don't change damage dealt.
    ignore: ['w.scaling.护盾', 'w.scaling.物理吸血', 'w.scaling.魔法吸血', 'e.scaling.移速降低'],
  },
  hwei: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP' },
      { path: 'abilities.q.variants[0].damage[0].base', row: 'q.scaling.没骨火丨基础伤害' },
      { path: 'abilities.q.variants[0].damage[0].ratios[1].value', row: 'q.scaling.没骨火丨最大生命值伤害', value: pctByRank },
      { path: 'abilities.q.variants[1].damage[0].base', row: 'q.scaling.攒聚雷丨基础伤害' },
      { path: 'abilities.q.variants[1].damage[0].ratios[1].value', row: 'q.scaling.攒聚雷丨基础额外伤害' },
      { path: 'abilities.q.variants[2].damage[0].base', row: 'q.scaling.连皴山丨爆炸伤害' },
      // The lava ticks every half second, so each tick is half the per-second number.
      { path: 'abilities.q.effects[0].tickAmount', row: 'q.scaling.连皴山丨持续伤害', value: (ranks) => ({ byRank: ranks.map((rank) => rank / 2) }) },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd' },
      { path: 'abilities.w.cost', row: 'w.scaling.MP' },
      { path: 'abilities.w.effects[0].bonus.base', row: 'w.scaling.宿墨丨基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP' },
      { path: 'abilities.e.variants[0].damage[0].base', row: 'e.scaling.阴沉变意丨基础伤害' },
      { path: 'abilities.e.variants[1].damage[0].base', row: 'e.scaling.滞涩幽瞳丨基础伤害' },
      { path: 'abilities.e.variants[2].damage[0].base', row: 'e.scaling.双钩血喉丨基础伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.effects[0].tickAmount', row: 'r.scaling.基础伤害' },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害#2' },
    ],
    ignore: [
      // Fleeting Current, Pool of Reflection and Stirring Lights' mana don't change damage dealt.
      'w.scaling.飞染丨持续时间', 'w.scaling.飞染丨移速加成', 'w.scaling.渲浓丨基础护盾', 'w.scaling.渲浓丨最大基础护盾',
      'w.scaling.宿墨丨法力回复',
      // E's crowd control.
      'e.scaling.阴沉变意丨恐惧时长', 'e.scaling.滞涩幽瞳丨禁锢时长', 'e.scaling.双钩血喉丨移速降低',
    ],
  },
  caitlyn: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP' },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.q.damage[0].ratios[0].value', row: 'q.scaling.攻击系数', value: pctByRank },
      // Traps recharge rather than cool down; the model's cooldown is the recharge time.
      { path: 'abilities.w.cooldown', row: 'w.scaling.充能时间' },
      { path: 'abilities.w.cost', row: 'w.scaling.MP', value: flat },
      { path: 'abilities.w.effects[0].bonus.base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP', value: flat },
      { path: 'abilities.e.damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
      { path: 'abilities.r.damage[0].ratios[0].value', row: 'r.scaling.额外攻击力', value: (ranks) => ranks[0] / 100 },
    ],
    // The trap count, W's 0 cooldown (it recharges) and R's range don't change damage dealt.
    ignore: ['w.scaling.陷阱', 'w.scaling.cd', 'r.scaling.攻击距离'],
  },
  senna: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd', value: flat },
      { path: 'abilities.q.cost', row: 'q.scaling.MP' },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd', value: flat },
      { path: 'abilities.w.cost', row: 'w.scaling.MP' },
      { path: 'abilities.w.damage[0].base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP', value: flat },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
    ],
    // Healing, shields, slows, roots and Wraith form don't change damage dealt.
    ignore: ['q.scaling.回复', 'q.scaling.持续时间', 'w.scaling.禁锢时长', 'e.scaling.持续时间', 'r.scaling.护盾'],
  },
  chogath: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd', value: flat },
      { path: 'abilities.q.cost', row: 'q.scaling.MP', value: flat },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd' },
      { path: 'abilities.w.cost', row: 'w.scaling.MP' },
      { path: 'abilities.w.damage[0].base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP', value: flat },
      { path: 'abilities.e.effects[0].bonus.base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.e.effects[0].bonus.ratios[1].value', row: 'e.scaling.最大生命值伤害', value: pctByRank },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
      { path: 'abilities.r.effects[0].perStack', row: 'r.scaling.最大生命值' },
    ],
    // W's silence, E's slow and Feast's attack range don't change damage dealt.
    ignore: ['w.scaling.沉默时长', 'e.scaling.移速降低', 'r.scaling.攻击距离'],
  },
  'master-yi': {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP' },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      // The three returning strikes deal 25% each.
      { path: 'abilities.q.damage[1].base', row: 'q.scaling.基础伤害', value: (ranks) => ({ byRank: ranks.map((rank) => rank / 4) }) },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd', value: flat },
      { path: 'abilities.w.cost', row: 'w.scaling.MP', value: flat },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.effects[2].bonus.base', row: 'e.scaling.真实伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.effects[0].amount', row: 'r.scaling.攻速加成', value: pctByRank },
    ],
    // Q's bonus against monsters, Meditate's heal and damage reduction, and Highlander's speed.
    ignore: ['q.scaling.额外伤害', 'w.scaling.回复', 'w.scaling.减伤比例', 'r.scaling.移速加成'],
  },
  yasuo: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd', value: flat },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd' },
      { path: 'abilities.e.damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.基础伤害' },
    ],
    // Wind Wall's width; E's per-dash cooldown (one target can only be dashed through once per 7 s, the model's cooldown).
    ignore: ['w.scaling.风墙宽度', 'e.scaling.cd'],
  },
  'miss-fortune': {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP', value: flat },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.q.damage[0].ratios[0].value', row: 'q.scaling.攻击系数', value: (ranks) => ranks[0] / 100 },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd', value: flat },
      { path: 'abilities.w.cost', row: 'w.scaling.MP', value: flat },
      { path: 'abilities.w.effects[0].amount', row: 'w.scaling.攻速加成', value: pctByRank },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP' },
      { path: 'abilities.e.effects[0].tickAmount', row: 'e.scaling.基础伤害' },
      { path: 'abilities.e.effects[0].ratios[0].value', row: 'e.scaling.法强系数', value: pctByRank },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.effects[0].tickAmount', row: 'r.scaling.基础伤害' },
      // One wave every 0.25 s, so the waves set the duration.
      { path: 'abilities.r.effects[0].durationSeconds', row: 'r.scaling.弹幕波数', value: (ranks) => ({ byRank: ranks.map((waves) => waves / 4) }) },
    ],
    // The bounce's crit, Strut's speed and Make It Rain's slow.
    ignore: ['q.scaling.暴击伤害率', 'w.scaling.移速加成', 'e.scaling.移速降低'],
  },
  nautilus: {
    links: [
      { path: 'abilities.q.cooldown', row: 'q.scaling.cd' },
      { path: 'abilities.q.cost', row: 'q.scaling.MP', value: flat },
      { path: 'abilities.q.damage[0].base', row: 'q.scaling.基础伤害' },
      { path: 'abilities.w.cooldown', row: 'w.scaling.cd', value: flat },
      { path: 'abilities.w.cost', row: 'w.scaling.MP', value: flat },
      { path: 'abilities.w.effects[0].bonus.base', row: 'w.scaling.基础伤害' },
      { path: 'abilities.e.cooldown', row: 'e.scaling.cd' },
      { path: 'abilities.e.cost', row: 'e.scaling.MP' },
      { path: 'abilities.e.damage[0].base', row: 'e.scaling.基础伤害' },
      { path: 'abilities.r.cooldown', row: 'r.scaling.cd' },
      { path: 'abilities.r.cost', row: 'r.scaling.MP', value: flat },
      { path: 'abilities.r.damage[0].base', row: 'r.scaling.主要伤害' },
    ],
    // The shield, the slow, and R's other targets and stun.
    ignore: ['w.scaling.护盾', 'w.scaling.最大生命值系数', 'e.scaling.移速降低', 'r.scaling.次要伤害', 'r.scaling.眩晕时间'],
  },
}
