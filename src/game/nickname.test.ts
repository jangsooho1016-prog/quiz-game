import { describe, expect, it } from 'vitest'
import { isValidNickname, nicknameError } from './nickname'

describe('nicknameError', () => {
  it.each(['퀴즈', '퀴즈왕', 'abcdefghij', '가나다라마바사아자차'])('"%s"는 허용', (name) => {
    expect(nicknameError(name)).toBeNull()
    expect(isValidNickname(name)).toBe(true)
  })

  it.each([
    ['', '입력하세요'],
    ['가', '2자 이상'],
    ['abcdefghijk', '10자 이하'],
    ['퀴즈 왕', '공백'],
    [' 퀴즈', '공백'],
    ['퀴즈\t', '공백'],
  ])('"%s"는 거부하고 이유를 알려 준다', (name, reason) => {
    expect(nicknameError(name)).toContain(reason)
    expect(isValidNickname(name)).toBe(false)
  })
})
