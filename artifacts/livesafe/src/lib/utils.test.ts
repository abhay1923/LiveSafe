import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    const result = cn('px-2', 'text-sm', 'px-4')
    expect(result).toBe('text-sm px-4')
  })
})
