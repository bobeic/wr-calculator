import type { EffectHandler } from '../effects/types'
import { fiendhunterOpeningBarrageHandler } from './fiendhunter-opening-barrage'
import { guinsoosPhantomHitHandler } from './guinsoos-phantom-hit'

/**
 * Handler id -> implementation for `kind: 'custom'` effects that don't fit the declarative model.
 */
export const CUSTOM_HANDLERS: Record<string, EffectHandler> = {
  'guinsoos-phantom-hit': guinsoosPhantomHitHandler as EffectHandler,
  'fiendhunter-opening-barrage': fiendhunterOpeningBarrageHandler as EffectHandler,
}
