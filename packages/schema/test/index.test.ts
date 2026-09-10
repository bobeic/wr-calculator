import { describe, it, expect } from 'vitest'
import * as schema from '../src/index'

describe('@wr-calc/schema public surface', () => {
  it('exports the core schemas', () => {
    expect(schema.StatKeySchema).toBeDefined()
    expect(schema.ScalarSchema).toBeDefined()
    expect(schema.EffectSchema).toBeDefined()
    expect(schema.ItemSchema).toBeDefined()
    expect(schema.ChampionSchema).toBeDefined()
    expect(schema.AbilitySchema).toBeDefined()
    expect(schema.RuneSchema).toBeDefined()
    expect(schema.BuildSchema).toBeDefined()
    expect(schema.TargetSchema).toBeDefined()
  })

  it('exports the validator', () => {
    expect(schema.validateItem).toBeDefined()
  })
})
