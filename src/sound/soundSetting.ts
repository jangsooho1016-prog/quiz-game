import type { KeyValueStorage } from '../storage/LocalStorageRankingRepository'

const SOUND_KEY = 'quiz-game/sound'

function defaultStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 효과음 설정. 저장된 값이 없거나 읽을 수 없으면 켜짐이 기본이다. */
export function loadSoundEnabled(storage: KeyValueStorage | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSoundEnabled(enabled: boolean, storage: KeyValueStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // 저장하지 못해도 이번 방문 동안은 화면 상태로 유지된다.
  }
}
