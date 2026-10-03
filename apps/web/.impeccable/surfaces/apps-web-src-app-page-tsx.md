---
version: 1
slug: "apps-web-src-app-page-tsx"
primary_target: "apps/web/src/app/page.tsx"
related_targets: ["apps/web/src/app/tier-list/page.tsx","apps/web/src/app/champions/[id]/page.tsx"]
---

# Home, tier list, champion page

Scope: site shell, home (Persuade), tier list and champion page (Operate). Audience: ranked Wild Rift players checking
what to pick and build, on laptop or phone. Pinned by owner: wildriftalpha.com's layout and gaming-site feel, dark,
splash art and icons. Constraints: static export, art from public/art (Tencent's WR art), English now but strings and
colours stay swappable for later languages and a light theme.

## Direction contract

THESIS: the site is Wild Rift's own loading screen turned into a scoreboard: the art is the data (the hero shows
whoever is winning right now), refusing the category default of a generic hero headline over a stock gradient.

OWN-WORLD: blue-black hextech ground (#070b14 to #111a2b), Wild Rift gold as the one primary accent, a cold cyan for
rising numbers, red for falling. Saira (variable width): condensed heavy caps-free display, normal-width body. Hairline
gold-tinted borders, square-ish 6px corners, splash art masked into the ground with a long fade, never boxed.

STORY: the visitor sees which champion is on top in CN ranked today, sees the top pick in every lane, and goes to the
tier list or a champion's build in one click; the calculator is offered as the deeper tool.

FIRST VIEWPORT: full-bleed splash of the #1 CN champion filling the right two thirds, fading into the ground at left;
left column holds a display headline (up to 3 lines) naming the champion and the claim, its win rate large with the
source and date under it, its most-picked Diamond+ core as item icons with a link that runs it in the calculator
(the differentiator, proven on real data), then the gold primary "Full tier list" button and a quiet "Build
calculator" link. Bottom edge: a row of five lane
cards (portrait card art, lane, champion, win %), overlapping the splash.

FORM: pinned brief, no concept roll: the owner pinned the direction in their own words ("i quite like wildriftalpha
the layout is nice and ... it has an appropriate style for a gaming site"; "we want both splash art and icons";
"start with dark"), and a pinned direction beats the roll; code-led, no image generation available.
Signature interaction: lane cards lift and brighten their art on hover/focus; tier tiles reveal pick and ban on hover.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
