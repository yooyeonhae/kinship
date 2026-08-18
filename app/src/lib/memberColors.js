export const MEMBER_COLOR_TOKENS = ['member-1', 'member-2', 'member-3', 'member-4']

export const MEMBER_BG_CLASS = {
  'member-1': 'bg-member-1',
  'member-2': 'bg-member-2',
  'member-3': 'bg-member-3',
  'member-4': 'bg-member-4',
}

export const MEMBER_TEXT_CLASS = {
  'member-1': 'text-member-1',
  'member-2': 'text-member-2',
  'member-3': 'text-member-3',
  'member-4': 'text-member-4',
}

export function colorTokenForMember(members, memberId) {
  const idx = members.findIndex((m) => m.member_id === memberId)
  if (idx === -1) return MEMBER_COLOR_TOKENS[0]
  return MEMBER_COLOR_TOKENS[idx % MEMBER_COLOR_TOKENS.length]
}
