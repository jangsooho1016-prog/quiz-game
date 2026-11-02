export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 10

/** F-01: 닉네임은 2~10자, 공백 불가. 규칙을 어기면 안내 문구를, 지키면 null을 돌려준다. */
export function nicknameError(nickname: string): string | null {
  const length = [...nickname].length
  if (length === 0) return '닉네임을 입력하세요.'
  if (/\s/.test(nickname)) return '닉네임에는 공백을 넣을 수 없습니다.'
  if (length < NICKNAME_MIN) return `닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`
  if (length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`
  return null
}

export function isValidNickname(nickname: string): boolean {
  return nicknameError(nickname) === null
}
