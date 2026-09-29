import { z } from 'zod'
import { BuildSchema } from '@wr-calc/schema'

const COMBO_ACTION_PATTERN = /^(AA|Q|W|E|R|dash|item:.+|wait:\d+(\.\d+)?)$/

export const GoldenScenarioSchema = z.object({
  championId: z.string(),
  level: z.number(),
  build: BuildSchema,
  target: z.object({
    hp: z.number(), armor: z.number(), mr: z.number(),
    startHpFraction: z.number().gt(0).max(1).optional(),
  }).strict(),
  combo: z.array(z.string().regex(COMBO_ACTION_PATTERN)),
}).strict()
export type GoldenScenario = z.infer<typeof GoldenScenarioSchema>

export const GoldenExpectedSchema = z.object({
  timeToKill: z.number().optional(),
  totalDamage: z.number().optional(),
}).strict()
export type GoldenExpected = z.infer<typeof GoldenExpectedSchema>

export const GoldenCaseSchema = z.object({
  scenario: GoldenScenarioSchema,
  expected: GoldenExpectedSchema,
  tolerance: z.number().positive(),
  patch: z.string(),
  source: z.literal('practice-tool'),
}).strict()
export type GoldenCase = z.infer<typeof GoldenCaseSchema>
