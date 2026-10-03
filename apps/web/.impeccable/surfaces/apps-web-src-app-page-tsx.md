---
version: 1
slug: "apps-web-src-app-page-tsx"
primary_target: "apps/web/src/app/page.tsx"
related_targets: ["apps/web/src/app/tier-list/page.tsx","apps/web/src/app/champions/[id]/page.tsx"]
---

# Home, tier list, champion page

Scope: site shell, home (now Operate-leaning: find a pick and its build fast), tier list and champion page (Operate).
Audience: ranked Wild Rift players checking what to pick and build, on laptop or phone; the owner (a streamer) also
theorycrafts off-meta builds. Owner, 2026-10-03: content may resemble other sites, but the design must not look like a
copy of wildriftalpha.com (the original reference). Dark, splash art and icons stay. Constraints: static export, art
from public/art, strings and colours swappable for later languages and a light theme.

## Direction contract

THESIS: the scoreboard, not the guide page: every first view answers "who wins, and with what" as a ranked readout,
refusing the reference site's slogan hero, browse-link grid and splash-card tier rows as the main structure.

OWN-WORLD: blue-black ground, gold as the one accent, cyan/red only for above/below 50%, plus damage-type colours
(physical orange, magic blue, true white) wherever damage is shown. Saira condensed heavy numbers, tabular. Win-rate
bars centred on 50%; glass board panels over masked splash art.

STORY: pick a lane, see the five highest win rates with their most-picked core, open a champion for builds; spot
"builds beating the meta" (cores out-winning the most-picked one) and compare them in the calculator.

FIRST VIEWPORT: home: left column headline, champion search, CN source line, one gold "Full tier list" button; right,
a glass lane board (lane tabs, five rows: place, icon, name, tier, pick/ban, win % with a 50%-centred bar, three core
item icons) over the lane leader's splash, which cross-fades when the lane changes. Champion page: a compact splash
hero so the builds panel starts in the first viewport on desktop.

FORM: owner-directed refinement of the 2026-10-03 pass (no concept roll), code-led, no image generation available.
Signature interaction: switching lanes re-deals the board (rows slide in staggered, splash blurs in). Tier list adds
a "Meta map" view (win rate against pick rate, icon points ringed in tier colour).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
