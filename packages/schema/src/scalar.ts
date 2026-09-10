import { z } from 'zod'

/**
 * A game value that may be constant or scale with champion level or ability rank.
 */
export const ScalarSchema = z.union([
  z.number(),
  z.object({ byLevel: z.array(z.number()) }).strict(),
  z.object({ levelRange: z.object({ min: z.number(), max: z.number() }).strict() }).strict(),
  z.object({ byRank: z.array(z.number()) }).strict(),
])
export type Scalar = z.infer<typeof ScalarSchema>

/** A Scalar that may be null when the real value hasn't been entered yet. */
export const NullableScalarSchema = ScalarSchema.nullable()
export type NullableScalar = z.infer<typeof NullableScalarSchema>
