import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../storage/MemoryStorage'
import { loadSoundEnabled, saveSoundEnabled } from './soundSetting'

describe('soundSetting (F-18)', () => {
  it('저장된 값이 없으면 켜짐이 기본이다', () => {
    expect(loadSoundEnabled(new MemoryStorage())).toBe(true)
  })

  it('끈 설정을 기억한다', () => {
    const storage = new MemoryStorage()
    saveSoundEnabled(false, storage)
    expect(loadSoundEnabled(storage)).toBe(false)
    saveSoundEnabled(true, storage)
    expect(loadSoundEnabled(storage)).toBe(true)
  })

  it('저장소를 쓸 수 없으면 켜짐으로 보고, 저장 실패는 무시한다', () => {
    const broken = new MemoryStorage()
    broken.getItem = () => {
      throw new Error('SecurityError')
    }
    broken.setItem = () => {
      throw new Error('SecurityError')
    }
    expect(loadSoundEnabled(broken)).toBe(true)
    expect(() => saveSoundEnabled(false, broken)).not.toThrow()
    expect(loadSoundEnabled(null)).toBe(true)
  })
})
