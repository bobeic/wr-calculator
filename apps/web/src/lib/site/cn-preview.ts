import { championHref, itemHref } from './format'

// Tencent's most common ability row labels (counted 2026-10-02); anything else shows in Chinese.
const ROW_LABELS: Record<string, string> = {
  cd: 'cooldown', cost: 'cost', MP: 'mana cost', Resource: 'cost', 基础伤害: 'base damage', 移速降低: 'slow',
  移速加成: 'move speed', 护盾: 'shield', 回复: 'heal', 攻速加成: 'attack speed', 攻击系数: 'AD ratio', 持续时间: 'duration',
  伤害比例: 'damage %', 二段基础伤害: 'second hit damage', 强化伤害: 'empowered damage', 额外伤害: 'bonus damage',
  充能时间: 'charge time', 首次基础伤害: 'first hit damage', 禁锢时长: 'root duration', 最低伤害: 'minimum damage',
  额外生命值: 'bonus Health', 最大基础伤害: 'maximum base damage', 双抗提升: 'Armor and MR', 对野怪最大伤害: 'max damage to monsters',
  额外攻击力: 'bonus AD', 额外攻击系数: 'bonus AD ratio', 法力恢复: 'mana restore', 眩晕时间: 'stun duration',
  伤害减免: 'damage reduction', 护甲提升: 'Armor', 护甲降低: 'Armor reduction', 魅惑时长: 'charm duration',
  暴击伤害率: 'crit damage', 攻击距离: 'attack range', 最大生命值: 'max Health', 最大生命值系数: 'max Health ratio',
  目标最大生命值: 'target max Health', 冷却时间: 'cooldown', 法强系数: 'AP ratio', 每秒伤害: 'damage per second',
}
const SLOT_LABELS: Record<string, string> = { p: 'Passive', q: 'Q', w: 'W', e: 'E', r: 'R' }

/** 'q.基础伤害' -> 'Q base damage', 'stat.ad' -> 'stat ad', 'base.hp' -> 'base hp'. */
export function cnFieldLabel(field: string): string {
  const dot = field.indexOf('.')
  if (dot === -1) return field
  const head = field.slice(0, dot)
  const rest = field.slice(dot + 1)
  if (head in SLOT_LABELS) return `${SLOT_LABELS[head]} ${ROW_LABELS[rest] ?? rest}`
  return `${head} ${rest}`
}

/** Our page for a preview entry, or null for CN-only ids ('item:cn-2119'). */
export function cnEntryHref(entry: string): string | null {
  const [kind, id] = entry.split(':')
  if (id.startsWith('cn-')) return null
  return kind === 'item' ? itemHref(id) : championHref(id)
}
