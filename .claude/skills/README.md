# Project skills

Design skills vendored for the site's design pass. Claude Code loads every folder here in each session on this repo.

| Skill | Source | Version |
|---|---|---|
| `impeccable` | https://github.com/pbakaus/impeccable (`.claude/skills/impeccable`), Apache 2.0 | v0.1.11, commit e103efe |
| `design-taste-frontend` | https://github.com/Leonxlnx/taste-skill (`skills/taste-skill`), MIT | commit ce26fc2 |
| `redesign-existing-projects` | https://github.com/Leonxlnx/taste-skill (`skills/redesign-skill`), MIT | commit ce26fc2 |

taste-skill's other skills (image generation, brutalist, minimalist, GSAP-heavy, Google Stitch) don't fit this site and
were left out. To update a skill, copy its folder from the source repo again and bump the row above.

impeccable's `scripts/impeccable` launcher downloads a binary on first run; if that fails, the skill falls back to
reading `PRODUCT.md` / `DESIGN.md` directly.
