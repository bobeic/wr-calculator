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
  // One Lifeline item. Seraph's Embrace's passive is also called Lifeline, but an item has a
  // single group and Seraph's is already in `tear`; whether it also blocks these is unconfirmed.
  lifeline: ['steraks-gage', 'maw-of-malmortius'],
}

export const EXCLUSIVE_GROUPS: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_MEMBERS).flatMap(([group, ids]) => ids.map((id) => [id, group]))
)
