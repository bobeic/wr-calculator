import type { RawChampion, RawItem } from '../../scripts/wrpocket/raw-schemas'
import { buildSnapshot } from '../../scripts/patch/snapshot'
import type { Snapshot } from '../../scripts/patch/snapshot'

/** A raw wrpocket item with sensible defaults, plus the fields the trimmer must drop. */
export function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: 'long-sword', name: { en: 'Long Sword', ja: 'ロングソード' },
    description: { en: '+12 Attack Damage', ja: '' }, price: '500',
    numeric_stats: { attackDamage: 12 }, category: { en: 'Physical', ja: '物理' },
    tier: 'basic', components: [], image_url: '/x.webp', gold_efficiency: 100,
    ...overrides,
  }
}

const LEVELS = Array.from({ length: 15 }, (_, index) => index + 1)

/** A raw wrpocket champion with linear stats for levels 1-15 and five ability slots. */
export function makeRawChampion(overrides: Partial<RawChampion> = {}): RawChampion {
  const stats = Object.fromEntries(LEVELS.map((level) => [`レベル${level}`, {
    体力: 500 + 100 * (level - 1), 体力自動回復: 8, マナ: 300, マナ自動回復: 10, 物理防御: 30,
    魔法防御: 30, 攻撃力: 50, 移動速度: 340, 攻撃速度: 0.7,
  }]))
  const ability = (name: string) => ({
    name: { en: name, ja: '' },
    description: { en: `${name} deals 80 / 130 / 180 / 230 (+85% AP) magic damage.`, ja: '' },
    scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/55/60/65' }],
    video_url: 'https://example.invalid/v.mp4',
  })
  return {
    id: 'annie', name: { en: 'Annie', ja: 'アニー' }, stats,
    abilities: {
      パッシブ: ability('Pyromania'), スキル1: ability('Disintegrate'), スキル2: ability('Incinerate'),
      スキル3: ability('Molten Shield'), アルティメット: ability('Summon Tibbers'),
    },
    skins: [], bio: 'dropped',
    ...overrides,
  }
}

/** A snapshot built the same way the CLI builds one. */
export function makeSnapshot(
  patch: string, updated: string, items: RawItem[], champions: RawChampion[],
): Snapshot {
  return buildSnapshot({ patch, updated }, items, champions)
}
