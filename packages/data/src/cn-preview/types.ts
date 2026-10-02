/**
 * Changes on Tencent's CN Wild Rift data feed (https://game.gtimg.cn/images/lgamem/act/lrlib/js/), checked daily.
 * wrpocket, our live source, mirrors this feed, so the preview is a log of CN *changing*, each change marked by
 * whether our live data already has it. See docs/superpowers/specs/2026-10-02-cn-patch-preview-design.md.
 */
export type LiveStatus = 'live' | 'cn-only' | 'unknown'

export interface CnChange {
  /** 'item:<id>' / 'champion:<id>'; ids Tencent has but global doesn't are 'item:cn-<equipId>'. */
  entry: string
  name: string
  /** e.g. 'price', 'stat.ad', 'q.基础伤害' (Tencent's row label), 'base.hp'. */
  field: string
  /** '' when the field is new / gone. */
  before: string
  after: string
  /** Whether our live (wrpocket) data already has `after`; 'unknown' when the field can't be compared. */
  live: LiveStatus
}

export interface CnChangeSet {
  /** Tencent's fileTime of the newest file (YYYY-MM-DD HH:MM:SS). */
  fileTime: string
  version: string
  changes: CnChange[]
}

export interface CnPreview {
  checkedAt: string
  version: string
  fileTime: string
  /** Newest first. Empty until the feed changes after the first snapshot. */
  log: CnChangeSet[]
  /** Fields where CN and our live data disagree right now (`before` = live, `after` = CN). */
  differsNow: CnChange[]
}
