import { describe, expect, it } from 'vitest'
import { statusLabel } from './format'
describe('Blog statusLabel', () => { it('formats post status', () => { expect(statusLabel('published')).toBe('已发布') }) })
