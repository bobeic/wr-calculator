import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { getPatchDataset, PATCH_IDS } from '../src/patches/registry'
import { PATCH_LAYERS } from '../src/patches/layers'

const PATCHES_DIR = new URL('../src/patches', import.meta.url).pathname

interface ReportedRef { kind: 'item' | 'champion'; id: string }
interface ReportFile { needsReview: ReportedRef[]; carriedStale: ReportedRef[] }

const key = (ref: ReportedRef): string => `${ref.kind} ${ref.id}`

describe.each(PATCH_IDS.slice(1))('patch %s', (patch) => {
  it('has a patch-diff.json report', () => {
    expect(existsSync(`${PATCHES_DIR}/${patch}/patch-diff.json`)).toBe(true)
  })

  // Overrides and reviews written after the run can only shrink the stale set; never grow it.
  it("dataset staleness matches the report's needs-review and carried entries", () => {
    const report = JSON.parse(readFileSync(`${PATCHES_DIR}/${patch}/patch-diff.json`, 'utf-8')) as ReportFile
    const dataset = getPatchDataset(patch)
    const stale = [
      ...[...dataset.stale.items.keys()].map((id) => `item ${id}`),
      ...[...dataset.stale.champions.keys()].map((id) => `champion ${id}`),
    ].sort()
    const layer = PATCH_LAYERS.find((candidate) => candidate.id === patch)
    if (layer === undefined) throw new Error(`no layer for ${patch}`)
    const covered = new Set([
      ...layer.overrideItems.map((entry) => `item ${entry.id}`),
      ...layer.overrideChampions.map((entry) => `champion ${entry.id}`),
      ...layer.reviewed.map((entry) => `${entry.kind} ${entry.id}`),
    ])
    const reported = [...report.needsReview, ...report.carriedStale].map(key)
    expect(stale).toEqual(reported.filter((entry) => !covered.has(entry)).sort())
  })
})
