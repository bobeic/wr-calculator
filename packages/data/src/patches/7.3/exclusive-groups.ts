// Items a single champion can hold at most one of per group, as reported by the user from the
// 7.3 client (2026-09-29). Components count as members: e.g. Last Whisper can't sit next to
// Mortal Reminder, and Seeker's Armguard's Stasis active can't sit next to another active.
// Pen boots (Spellslinger's Shoes, Armorcrusher Boots) are not in the pen groups.
const GROUP_MEMBERS: Record<string, string[]> = {
  // One Tear of the Goddess item: Tear itself and everything built from it.
  tear: [
    'tear-of-the-goddess', 'archangels-staff', 'seraphs-embrace', 'manamune', 'winters-approach',
    'whispering-circlet',
  ],
  'active-item': [
    'stridebreaker', 'goredrinker', 'quicksilver-sash', 'mercurial-scimitar', 'galeforce',
    'redemption', 'hextech-rocketbelt', 'seekers-armguard', 'zhonyas-hourglass',
    'locket-of-the-iron-solari', 'gargoyle-stoneplate', 'mikaels-blessing', 'shurelyas-battlesong',
  ],
  // % armor pen items plus the armor shred items; one of any of them.
  'armor-pen': [
    'last-whisper', 'dominiks-regards', 'mortal-reminder', 'seryldas-grudge', 'terminus',
    'black-cleaver',
  ],
  // % magic pen items plus Bloodletter's Curse's magic resist shred; one of any of them.
  'magic-pen': ['void-amethyst', 'void-staff', 'cryptbloom', 'bloodletters-curse'],
  // One Lifeline item. The shared-passive rule (Item.uniquePassives) now covers this and also blocks Mantle of the
  // Twelfth Hour (user, 2026-10-03: one of Sterak's, Maw and Mantle) and Immortal Shieldbow; kept as the user's 7.3
  // reading. Seraph's Embrace is not blocked (user, 2026-10-03).
  lifeline: ['steraks-gage', 'maw-of-malmortius'],
}

export const EXCLUSIVE_GROUPS: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_MEMBERS).flatMap(([group, ids]) => ids.map((id) => [id, group]))
)
