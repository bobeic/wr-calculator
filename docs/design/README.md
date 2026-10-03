# Site design: how it was made and how to change it

## How the current design was made (2026-10-03)

- **Brief:** the owner pointed at wildriftalpha.com (layout and gaming-site feel), asked for splash art and icons, and
  dark first; light mode and other languages are likely later. Product facts are in `apps/web/PRODUCT.md`.
- **Skills:** done with the `impeccable` skill (vendored, with two taste-skill skills, in `.claude/skills/`; sources in
  `.claude/skills/README.md`). Its flow: `PRODUCT.md` → a direction contract in
  `apps/web/.impeccable/surfaces/apps-web-src-app-page-tsx.md` → build → desktop and mobile screenshots →
  `impeccable detect` → a separate reviewer agent (first verdict "fix", 8 findings; after the fixes, "ship") →
  `apps/web/DESIGN.md` and `apps/web/.impeccable/design.json` describing the built system. Code-led: no image
  generation was available, so there were no mock-up images.
- **Scope of the first pass:** site shell (header, nav, footer), home, tier list, champion page. Items, runes, patches
  and the calculator only picked up the new tokens.
- **Screenshots:** `docs/design/2026-10-03/`.

## Where things live

| What | Where |
|---|---|
| Colours, spacing, radius, fonts (tokens) and all CSS | `apps/web/src/app/globals.css` (tokens in the `:root` block at the top) |
| Font (Saira, self-hosted by next/font) and site shell | `apps/web/src/app/layout.tsx`, `apps/web/src/components/site/site-nav.tsx` |
| Line icons (arrow, lanes) | `apps/web/src/components/site/icons.tsx` |
| Pages | `apps/web/src/app/page.tsx`, `tier-list/page.tsx`, `champions/[id]/page.tsx`, … |
| Game art lookup | `apps/web/src/lib/site/art.ts` (reads `public/art/manifest.json` at build time) |
| Game art download | `packages/data/scripts/art-update.ts` |
| Design rules for future work | `apps/web/DESIGN.md` |

## Game art

`pnpm --filter @wr-calc/data art:update` downloads Tencent's Wild Rift art (champion icon, landscape splash, portrait
card and ability icons; item, rune and summoner spell icons) as WebP into `apps/web/public/art/` and writes
`manifest.json`. Riot's Data Dragon fills ability icons Tencent doesn't serve. The folder is gitignored: the web
`build` script runs the download first (only new files are fetched; ~10 s when nothing changed) and the deploy
workflow caches it. Run it once before `pnpm --filter @wr-calc/web dev`. `--refresh` re-downloads everything (e.g.
after a champion's splash changes). Missing art never breaks a page; the image is just left out.

## Making further edits

1. **Small changes** (a colour, spacing, a component): edit the token or rule in `globals.css`. Keep every colour a
   token; never hard-code one in a page. Follow `apps/web/DESIGN.md` (one gold accent; cyan/red only for win rate above
   or below 50%; no labels above headings; splash art masked into the background, never boxed).
2. **A new page or a redesign of one** (items, runes, patches, calculator are next): in a Claude session, ask it to use
   the `impeccable` skill on that page, e.g. "use impeccable to redesign the items pages in the style of DESIGN.md".
   It reads `PRODUCT.md` and `DESIGN.md`, so the new page inherits the system. Review commands: `/impeccable critique`,
   `/impeccable audit`, `/impeccable polish <page>`.
3. **Check it:** `pnpm --filter @wr-calc/web build`, serve `apps/web/out/` (e.g. `python3 -m http.server -d
   apps/web/out 4173`) and look at desktop (1440 wide) and phone (390 wide); then `pnpm typecheck && pnpm test`.
   `.claude/skills/impeccable/scripts/impeccable detect --json <changed files>` flags common AI-design tells.
4. **Light theme later:** add a second token block (e.g. `:root[data-theme="light"] { … }`) redefining the same
   variables, plus a toggle; components shouldn't need changes.
5. **Other languages later:** UI strings are inline in the page components today; move them into per-language files
   first. Champion and item names would need Riot's or Tencent's localized data.
6. If the design changes in a lasting way, update `apps/web/DESIGN.md` so later work follows the new rules.

## Open ideas from the review

Art on the tier list beyond the S+ row; more framing on detail sections (builds, abilities); tier tiles revealing
pick and ban on hover; the site's name (still "wr-calc", see `docs/next-steps.md`).
