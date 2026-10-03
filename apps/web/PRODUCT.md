# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Wild Rift ranked players who want to know what to pick and build this patch: which champions are strong, what the
best players build, and what changed. They check it before or between games, on whatever device is at hand (often a
laptop or desktop rather than the phone they play on, but phones too). A smaller group of theorycrafters uses the
damage calculator to dig into build maths.

## Product Purpose

A Wild Rift reference site: CN-server tier list and win rates, champion pages with CN Diamond+ builds, items, runes,
patch notes with every changed value, and a build damage calculator. Success is a ranked player getting a confident
pick-and-build answer in seconds, and coming back each patch.

## Positioning

Data straight from the China server (Tencent's ranked stats, wrchina.gg Diamond+ builds, a daily log of CN-only
changes before they reach global) plus a real calculation engine: combo damage, time to kill, two-build comparison and
"best first item", none of which listing sites offer. The calculator is the depth layer and differentiator, not the
headline; the browse pages are the main draw. More theory content may come later. (Owner delegated this framing,
2026-10-03.)

## Operating Context

- Static Next.js export on GitHub Pages (`/wr-calculator/` sub-path until a custom domain is bought); no server, no
  accounts.
- Data refreshes daily by GitHub workflow (CN win rates, builds, CN preview log); patch data via `patch:update`.
- Calculator state lives in the URL, so links reproduce a setup.

## Capabilities and Constraints

- Pages: home, tier list (bracket and lane filters), champions, items, runes, patches, CN patch preview, calculator,
  `/debug`.
- Terminology: Baron / Jungle / Mid / Dragon / Support lanes; CN = China server; tiers S+ / S / A / B / C (placeholder
  cut of Tencent's strength order).
- English only for now; other languages and a light theme are likely later, so UI strings and colours must stay easy
  to swap.
- Must look good on phones, tablets and desktops alike.
- Name undecided: working name "wildriftbuilds"; the site currently says "wr-calc".

## Brand Commitments

- Owner reference: wildriftalpha.com, for its layout and gaming-site feel (dark, splash art, icons). Dark theme first.
- Champion splash art and champion/item icons are wanted, downloaded at build time and served from the site, not
  hotlinked.
- Footer keeps the "not endorsed by Riot Games" fan-site disclaimer.

## Evidence on Hand

Real data only: CN win/pick/ban rates, CN Diamond+ builds, patch diffs, official notes, every champion's hand-modelled
kit. No user counts, testimonials or accuracy claims exist; most modelled values are not yet checked in game
(`docs/test-sheets/pending-checks.md`), so the site must not claim verified accuracy.

## Product Principles

- Answer "what do I pick and build" first; depth is one click away, never in the way.
- Show the source and date of every number (CN ranked, patch, refresh date).
- Never claim more certainty than the data has.
- Fast and readable on any device.
