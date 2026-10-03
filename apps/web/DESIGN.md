---
name: wr-calc
description: Wild Rift's loading screen turned into a scoreboard — splash art as data on a blue-black hextech ground.
colors:
  ground: "#070b14"
  ground-raised: "#0b1220"
  surface: "#0f1829"
  surface-2: "#15213a"
  text: "#e8ecf4"
  muted: "#98a4bb"
  faint: "#6f7c95"
  gold: "#e4b65c"
  gold-hover: "#f2cb7c"
  on-gold: "#1b1305"
  link-gold: "#f0c878"
  rising-cyan: "#5ed6c8"
  falling-red: "#f08473"
  tier-splus: "#f2c066"
  tier-s: "#e0a659"
  tier-a: "#5ed6c8"
  tier-b: "#8fa3c7"
  tier-c: "#6f7c95"
  hairline: "rgb(214 178 106 / 0.14)"
  hairline-strong: "rgb(214 178 106 / 0.34)"
typography:
  display:
    fontFamily: "Saira, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6.2vw, 5.2rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 78"
  headline:
    fontFamily: "Saira, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 1.02
    fontVariation: "'wdth' 78"
  title:
    fontFamily: "Saira, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2rem)"
    fontWeight: 800
    lineHeight: 1.02
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "Saira, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'wdth' 92"
    fontFeature: "'tnum'"
  label:
    fontFamily: "Saira, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  gap: "16px"
  gutter: "clamp(16px, 4vw, 40px)"
  section: "56px"
  max: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.sm}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  segmented-option-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "40px"
  panel:
    backgroundColor: "{colors.ground-raised}"
    rounded: "{rounded.lg}"
  lane-chip:
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "36px"
---

# Design System: wr-calc

## Overview

The site reads like Wild Rift's own loading screen turned into a scoreboard: the art is the data. The champion whose
splash fills a hero is there because the numbers put them there (the CN lane leader on the home page, the champion on
their own page). Splash art is never boxed; it is masked into the blue-black ground with a long fade from the reading
side. Everything else is a quiet, gold-hairlined frame around numbers. Dark only for now; a light theme is a second
token block (see Colors).

Surfaces: home is Persuade (lead with who's winning, one gold action); tier list and champion pages are Operate (scan,
compare, click through), so their brand lives in details: tier colours, icons, hairlines.

## Colors

Restrained: a tinted blue-black neutral ramp plus one accent, Wild Rift gold. Gold is the only accent: primary
buttons, the active nav/toggle underline, dates in datelines, the S+/S tiers, ability key badges. Cyan and red are
data colours only: a win rate at or above 50% is cyan, below is red. Never use them decoratively.

- Ground `#070b14` → raised `#0b1220` → surface `#0f1829` → surface-2 `#15213a`: depth is tonal, each step one layer up.
- Borders are gold-tinted hairlines (`--line`, `--line-strong`), never grey.
- Text `#e8ecf4`, muted `#98a4bb` for secondary copy, faint `#6f7c95` only for tertiary labels and large text.
- Scrims and glass (`--scrim`, `--scrim-soft`, `--glass`, `--header-bg`) are the ground at partial strength; they sit
  over art so text stays legible.

Every colour in pages and components is a custom property from the `:root` block in `src/app/globals.css`. Adding a
light theme means redefining those tokens under `:root[data-theme="light"]`, not touching components.

## Typography

One family, Saira (self-hosted by `next/font`), used on its width axis: condensed (78%) and heavy (800) for display,
headings, champion names and big numbers; 92% width at 400 for body. Tabular numerals everywhere so rates line up.
Display tops out at 6rem (champion title); home headline `clamp(2.6rem, 6.2vw, 5.2rem)`. Body measure stays under
72ch. No all-caps labels, no letter-spaced kickers.

## Layout

- Container `1240px` with a fluid gutter `clamp(16px, 4vw, 40px)`; heroes bleed full width (`main.bleed`).
- Hero: art occupies the right ~78% and fades out toward the copy on the left; on phones (≤760px) the art moves above
  the copy and fades downward.
- Sections separate by 56px above headings, tighter below.
- Grids are content-driven: tier tiles `auto-fill, minmax(236px, 1fr)`; S+ banners `auto-fit, minmax(260px, 1fr)`;
  the home lane strip is 5 columns on desktop and a snap-scrolling row on phones.
- Breakpoints: 960px (two-column layouts collapse), 760px (mobile header, art above copy, single-column lists).

## Elevation & Depth

Mostly flat tonal layering. One soft drop shadow (`--shadow`, `0 18px 40px -18px`) under floating art cards, and a
gold glow under the primary button. Header is a blurred `--header-bg` bar. No hard offset shadows.

## Shapes

Square-ish 6px corners (`--radius`), 8–10px on panels and cards, pills only for lane chips and small tags. Icons sit
in 6px-rounded squares with a hairline (items, abilities) or circles (runes). Line icons (`components/site/icons.tsx`)
are authored on a 24px grid with a 1.6 stroke.

## Components

- **Primary button** (`.button`): gold fill, dark ink, 48px tall, arrow icon that nudges on hover. One per view.
- **Quiet link** (`.quiet-link`): text plus arrow, for secondary actions beside a primary button.
- **Segmented toggle** (`.segmented`): lane/bracket filters; active option gets surface-2 and a gold underline; scrolls
  sideways on phones instead of wrapping.
- **Lane card / tier card**: art fills the card under a bottom scrim; name in condensed 800, stats under it. Hover
  lifts 3–4px and scales the art 5%.
- **Tier row**: tier letter in its tier colour beside a grid; S+ uses splash banners, other tiers icon tiles (52px icon,
  name, rank, win/pick/ban as separate unbroken spans).
- **Item path** (`.item-path`): icons joined by short hairline connectors, names under them on champion pages.
- **Ability row**: 56px icon with a gold key badge (Q/W/E/R/Passive), name, paragraphs; rows separated by hairlines in
  one panel.
- **Table** (`StatTable`): raised panel, hairline rows, right-aligned numbers.

## Do's and Don'ts

- Do let real art carry the page; use Tencent's Wild Rift art from `public/art` (downloaded by `art:update`), never a
  gradient standing in for missing art.
- Do show the source and date with every rate, under the heading it belongs to, not as a label above it.
- Do keep gold as the single accent; cyan/red mean "above/below 50%" and nothing else.
- Don't put eyebrow/kicker labels above headings.
- Don't hard-code colours in components; add a token.
- Don't box splash art in a frame; mask it into the ground.
