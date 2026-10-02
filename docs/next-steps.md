# Next steps

Where the project stands (2026-10-03) and what comes next. Update this file as items are done.

## Where it stands

- The site is live at https://bobeic.github.io/wr-calculator/ and redeploys on every push to `main`
  (`.github/workflows/deploy-site.yml`).
- The daily CN win-rate and patch-check workflows run on schedules and open pull requests when something changes.
- Champion pages show CN Diamond+ builds (top 3-item cores and rune pages per lane, each with a "Try" link into the
  calculator), from `https://wrchina.gg/api/build/<heroId>_1.json`, refreshed by the same daily workflow. Upgraded
  support items and transformed items (Muramana, Seraph's, Fimbulwinter) show as their base item; Diadem of Songs
  isn't in wrpocket's item list, so the builds that contain it (Sona support) are dropped. wrchina also serves
  Master+ (`_2`) and Challenger (`_3`) if we ever want them.
- Pages: home, CN tier list, champions, items, runes, patches, the calculator (two-build comparison, damage per ability,
  time to kill) and `/debug`.
- Hand-modelled champion kits: Ambessa; Darius, Lee Sin, Hwei (all nine spells), Caitlyn, Senna; Cho'Gath, Master Yi,
  Yasuo, Miss Fortune, Nautilus; Garen, Xin Zhao, Brand, Yunara, Thresh; Mordekaiser, Viego, Veigar, Tristana, Leona;
  Sett, Graves, Galio, Samira, Lux; Dr. Mundo, Tryndamere, Mel, Jinx, Seraphine; Nasus, Kha'Zix, Akali, Draven,
  Blitzcrank; Aatrox, Nocturne, Yone, Jhin, Malphite; Volibear, Jarvan IV, Morgana, Kai'Sa, Yuumi; K'Sante, Kayn,
  Ahri, Ashe, Lulu; Teemo, Pantheon, Ziggs, Ezreal, Pyke; Urgot, Vi, Ekko, Kalista, Zyra; Renekton, Shyvana, Syndra,
  Twitch, Swain; Kayle, Kindred, Aurelion Sol, Vayne, Braum; Fiora, Wukong, Twisted Fate, Smolder, Soraka; Gnar,
  Rammus, Zed, Varus, Alistar; Jax, Nidalee, Aurora, Lucian, Maokai; Gwen, Rengar, Viktor, Xayah, Karma; Jayce,
  Warwick, Orianna, Sivir, Nami; Riven, Lillia, Vel'Koz, Kog'Maw, Rell; Rumble, Skarner, Ryze, Zeri, Rakan. The other 36 champions use auto-imported ability numbers ("rough kit" on the site).
- Every item and rune that changes a damage number is modelled. Most values are unchecked in game; the open questions
  are in `docs/test-sheets/pending-checks.md`.

## Domain (not bought yet)

The working name is **wildriftbuilds**. When checked on 2026-10-03, `wildriftbuilds.com`, `wildriftbuilds.app` and
`wildriftbuild.com` were unregistered; `.gg` couldn't be checked. Other free options were `riftmath.com` / `.app`,
`riftcalc.com` / `.app`, `riftsheet.com` and `wrtheory.com`. "Wild Rift" is Riot's trademark: fan sites commonly use it
and the footer already says the site is unaffiliated, but a name without it (e.g. riftmath) avoids the question.

Steps once a name is chosen:

1. **Buy it** from a registrar: Cloudflare Registrar (at cost; check it sells the ending you want, e.g. `.gg`) or
   Porkbun. Turn on auto-renew.
2. **Add DNS records** at the registrar (Cloudflare: set them to "DNS only", not proxied):

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | bobeic.github.io |

3. **Repo Settings → Pages → Custom domain**: enter the domain, wait for the DNS check, then tick "Enforce HTTPS".
4. **Optional:** verify the domain under your GitHub account's Settings → Pages, so no one else can point a site at it.
5. **Re-run the "Deploy site" workflow.** With a custom domain the build drops the `/wr-calculator/` sub-path
   automatically.
6. **Rename the site** from "wr-calc" to the chosen name (header, page titles, footer, README).

## Needs the owner

- **Site design.** Sites you like and dislike; dark first, light first or both; whether to show champion and item
  icons (Tencent's CDN has them, but using them raises licensing and reliability questions). The styling is one token
  block in `apps/web/src/app/globals.css`, so a redesign doesn't touch the pages.
- **Tier letters.** The S+/S/A/B/C cut (top 8% / 17% / 25% / 25% / 25% of Tencent's strength order) is a placeholder.
  Keep it, change the cut, or tier by win rate?
- **CN leaking into live data (FYI, decide when convenient).** wrpocket's items copy Tencent's CN feed (timestamps
  match to the second), so when CN patches before global, `patch:update` may import CN item numbers as global. Its
  champion numbers differ from Tencent's in ~300 ability rows, so champions look sourced separately. The CN preview
  log shows a leak as "already live" before the global notes. Gate the import on it, or just watch?
- **In-game checks**, in `docs/test-sheets/pending-checks.md`. The most useful: Caitlyn's Headshot (6th or 7th
  attack?), Nautilus's passive and Miss Fortune's Love Tap at level 15, Master Yi's Wuju passive, Yasuo's crit damage,
  a few rows of `docs/test-sheets/predictions-7.3a.md`, and skimming the ranged list in
  `packages/data/src/attack-types.ts`.

## Development, roughly in order

1. **More champion kits.** Continue down the CN pick rates (the next unmodelled pick per lane: Camille, Evelynn, Fizz, Sona; every Dragon-lane pick is now modelled).
2. **Runes and spells in the patch pipeline:** done — `patch:update` now fetches wrpocket's `runes.json` and
   `spells.json` into each patch snapshot and lists every added, removed or reworded rune/spell (with the numbers
   that moved) in a "Runes and summoner spells" section of `PATCH_DIFF.md`. The models in `runes.ts`/`spells.ts` stay
   hand-written and carry into later patches unchanged; a flagged one gets a corrected list in the new patch's layer.
3. **Calculator polish:** done — ability ranks in the UI, a per-build item order (gold/burst/DPS/TTK at each item,
   via the new `buildBreakpoints`), and picking a champion target's runes (turned out already wired: `TargetPicker`
   already reuses the same `BuildPanel` as the attacker's build, runes included — just checked it actually changes
   the target's resolved stats).
4. **"Best first item" view:** done — a "Best first item" panel in the calculator ranks every legendary item bought
   alone by time to kill, computed lazily (only once opened) so it doesn't slow down every edit.
5. **Patch preview:** v1 done — `/patches/cn-preview/` (design: `docs/superpowers/specs/2026-10-02-cn-patch-preview-design.md`).
   `cn-preview:update` (in the daily CN workflow) snapshots Tencent's item and hero feed to
   `snapshots/tencent/latest.json`, logs every field that changes from one day to the next (marked "already live" /
   "CN only" / "?"), and lists where CN and live disagree today. That second list is ~340 rows, nearly all champion
   ability rows (e.g. Aatrox Q 10/40/70/100 live vs 15/45/75/105 CN): wrpocket's champion numbers are *not* a straight
   copy of Tencent's, unlike its items. A few rows look like Tencent glitches (Ahri E shows one value). Later: the
   calculated preview (brainstorm §4.2), if the log shows CN changes worth simulating.
6. **Design pass** once the design answers are in.
7. **Housekeeping:** done — workflow actions bumped off Node 20.
