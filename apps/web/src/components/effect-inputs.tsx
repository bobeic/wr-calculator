'use client'

import type { EffectInput } from '@wr-calc/schema'
import { inputValue } from '../lib/collect-inputs'

interface EffectInputsProps {
  inputs: EffectInput[]
  values: Record<string, number | boolean>
  onChange: (id: string, value: number | boolean) => void
  /** Wraps each control, e.g. to lay them out as a list. */
  className?: string
}

/** One control per effect input: a number box for a stack count, a checkbox for a toggle. */
export function EffectInputs({ inputs, values, onChange, className }: EffectInputsProps) {
  return (
    <>
      {inputs.map((input) => {
        const value = inputValue(input, values)
        return input.type === 'stackCount' ? (
          <label key={input.id} className={className}>
            {input.label}{' '}
            <input
              type="number" min={input.min} max={input.max}
              value={typeof value === 'number' ? value : input.default}
              onChange={(event) => {
                const stacks = Number(event.target.value)
                if (Number.isFinite(stacks)) onChange(input.id, Math.min(input.max, Math.max(input.min, stacks)))
              }}
            />{' '}
          </label>
        ) : (
          <label key={input.id} className={className}>
            <input type="checkbox" checked={value === true} onChange={(event) => onChange(input.id, event.target.checked)} />
            {input.label}{' '}
          </label>
        )
      })}
    </>
  )
}
