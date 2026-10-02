import type { Build, Item, Rune } from '@wr-calc/schema'
import { HAS_SEPARATE_BOOTS_SLOT, HAS_SEPARATE_ENCHANT_SLOT, ITEM_SLOTS } from './rules'

export type BuildIssueCode =
  | 'unknown-item' | 'too-many-items' | 'duplicate-item' | 'boots-in-items' | 'not-boots' | 'exclusive-group'
  | 'shared-passive' | 'too-many-keystones'

export interface BuildIssue {
  code: BuildIssueCode
  message: string
}

// Tiers a build may hold only one copy of. Components (basic, epic) can be bought twice; finished items can't.
// The slot count is verified (5 + boots); so is one copy of each finished item (user, 2026-10-02).
const UNIQUE_TIERS: ReadonlySet<Item['tier']> = new Set(['legendary', 'boots', 'enchant', 'support'])

/**
 * Checks a build against the shop rules: known items, slot count (rules.ts ITEM_SLOTS), one copy of each
 * finished item, boots only in the boots slot, at most one item per exclusive group, and at most one finished item
 * per named passive, and at most one keystone rune. Returns every issue found.
 */
export function validateBuild(build: Build, items: ReadonlyMap<string, Item>, runes?: ReadonlyMap<string, Rune>): BuildIssue[] {
  const issues: BuildIssue[] = []
  const lookup = (id: string): Item | undefined => {
    const item = items.get(id)
    if (!item) issues.push({ code: 'unknown-item', message: `unknown item id '${id}' in build` })
    return item
  }
  const listed = build.items.map(lookup)
  const boots = build.boots === undefined ? undefined : lookup(build.boots)
  const enchant = build.enchant === undefined ? undefined : lookup(build.enchant)

  const slotsUsed = build.items.length
    + (build.boots !== undefined && !HAS_SEPARATE_BOOTS_SLOT ? 1 : 0)
    + (build.enchant !== undefined && !HAS_SEPARATE_ENCHANT_SLOT ? 1 : 0)
  if (slotsUsed > ITEM_SLOTS) {
    issues.push({ code: 'too-many-items', message: `the build uses ${slotsUsed} item slots; the inventory has ${ITEM_SLOTS}` })
  }
  for (const item of listed) {
    if (item?.tier === 'boots') {
      issues.push({ code: 'boots-in-items', message: `'${item.id}' is boots; put it in the boots slot` })
    }
  }
  if (boots !== undefined && boots.tier !== 'boots') {
    issues.push({ code: 'not-boots', message: `'${boots.id}' in the boots slot is not boots` })
  }

  const all = [...listed, boots, enchant].filter((item): item is Item => item !== undefined)
  const seen = new Set<string>()
  const reported = new Set<string>()
  const holderByGroup = new Map<string, string>()
  const holderByPassive = new Map<string, string>()
  for (const item of all) {
    // User, 2026-10-02: a build can't hold two finished items with the same named passive.
    if (UNIQUE_TIERS.has(item.tier)) {
      for (const passive of item.uniquePassives ?? []) {
        const holder = holderByPassive.get(passive)
        if (holder === undefined) holderByPassive.set(passive, item.id)
        else if (holder !== item.id && !reported.has(`${holder}|${item.id}`)) {
          reported.add(`${holder}|${item.id}`)
          issues.push({
            code: 'shared-passive',
            message: `items '${holder}' and '${item.id}' can't be held together (both have the unique passive '${passive}')`,
          })
        }
      }
    }
    if (UNIQUE_TIERS.has(item.tier) && seen.has(item.id) && !reported.has(item.id)) {
      issues.push({ code: 'duplicate-item', message: `'${item.id}' is in the build twice; a finished item can be held once` })
      reported.add(item.id)
    }
    seen.add(item.id)
    if (!item.exclusiveGroup) continue
    const holder = holderByGroup.get(item.exclusiveGroup)
    if (holder !== undefined && holder !== item.id) {
      issues.push({
        code: 'exclusive-group',
        message: `items '${holder}' and '${item.id}' can't be held together (both in exclusive group '${item.exclusiveGroup}')`,
      })
    } else {
      holderByGroup.set(item.exclusiveGroup, item.id)
    }
  }
  // A rune page has one keystone (rune slot 'keystone'). Unknown rune ids are resolveStats' error, not a shop rule.
  const keystones = build.runes.filter((id) => runes?.get(id)?.slot === 'keystone')
  if (keystones.length > 1) {
    issues.push({ code: 'too-many-keystones', message: `the build has ${keystones.length} keystones (${keystones.join(', ')}); a rune page has one` })
  }
  return issues
}
