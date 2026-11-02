import type { KeyValueStorage } from './LocalStorageRankingRepository'

/** localStorage를 쓸 수 없을 때(사생활 보호 모드 등)와 테스트에서 쓰는 메모리 저장소. */
export class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}
