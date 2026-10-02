# Next steps

Where the project stands (2026-10-03) and what comes next. Update this file as items are done.

## Where it stands

- The site is live at https://bobeic.github.io/wr-calculator/ and redeploys on every push to `main`
  (`.github/workflows/deploy-site.yml`).
- The daily CN win-rate and patch-check workflows run on schedules and open pull requests when something changes.
- Pages: home, CN tier list, champions, items, runes, patches, the calculator (two-build comparison, damage per ability,
  time to kill) and `/debug`.
- Hand-modelled champion kits: Ambessa; Darius, Lee Sin, Hwei (all nine spells), Caitlyn, Senna; Cho'Gath, Master Yi,
  Yasuo, Miss Fortune, Nautilus; Garen, Xin Zhao, Brand, Yunara, Thresh. The other 126 champions use auto-imported
  ability numbers ("rough kit" on the site).
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

- **Builds source.** Champion pages can't show builds until there's a source. Open wrchina.gg or Tencent's
  掌上英雄联盟 app on one champion's build page with browser devtools, and send the request URLs from the Network tab.
- **Site design.** Sites you like and dislike; dark first, light first or both; whether to show champion and item
  icons (Tencent's CDN has them, but using them raises licensing and reliability questions). The styling is one token
  block in `apps/web/src/app/globals.css`, so a redesign doesn't touch the pages.
- **Tier letters.** The S+/S/A/B/C cut (top 8% / 17% / 25% / 25% / 25% of Tencent's strength order) is a placeholder.
  Keep it, change the cut, or tier by win rate?
- **In-game checks**, in `docs/test-sheets/pending-checks.md`. The most useful: Caitlyn's Headshot (6th or 7th
  attack?), Nautilus's passive and Miss Fortune's Love Tap at level 15, Master Yi's Wuju passive, Yasuo's crit damage,
  a few rows of `docs/test-sheets/predictions-7.3a.md`, and skimming the ranged list in
  `packages/data/src/attack-types.ts`.

## Development, roughly in order

1. **More champion kits.** Continue down the CN pick rates (third most-picked per lane, and so on).
2. **Runes and spells in the patch pipeline.** They're hand-copied now; importing them from wrpocket each patch would
   keep them current. `https://wrpocket.app/site_data/champions/<slug>.json` already carries full tooltip text and
   per-rank tables (used for the batch 3 kits below) — the champion page itself only renders descriptions for some
   abilities client-side, so fetch this JSON directly rather than the page HTML.
3. **Calculator polish:** done — ability ranks in the UI, and a per-build item order (gold/burst/DPS/TTK at each
   item, via the new `buildBreakpoints`). Still open: picking a champion target's runes.
4. **"Best first item" view:** time to kill for every legendary on a given champion, built on the build comparison.
5. **Patch preview:** Tencent's CN data runs ahead of global servers, so it can show changes before they arrive.
6. **Design pass** once the design answers are in.
7. **Housekeeping:** GitHub warns that the workflows' actions (checkout, setup-node, pnpm, configure-pages) target
   Node 20, which is deprecated; bump them when newer versions are available.
