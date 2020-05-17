const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.getDuration(stringOrNumber) {GETTER}', () => {
    it('is a function', () => {
      expect(typeof apicache.getDuration).toBe('function')
    })

    it('returns value unchanged if numeric', () => {
      expect(apicache.getDuration(77)).toBe(77)
    })

    it('returns default duration when uncertain', () => {
      apicache.options({ defaultDuration: 999 })
      expect(apicache.getDuration(undefined)).toBe(999)
    })

    it('accepts singular or plural (e.g. "1 hour", "3 hours")', () => {
      expect(apicache.getDuration('3 seconds')).toBe(3000)
      expect(apicache.getDuration('3 second')).toBe(3000)
    })

    it('accepts decimals (e.g. "1.5 hours")', () => {
      expect(apicache.getDuration('1.5 seconds')).toBe(1500)
    })

    describe('unit support', () => {
      it('numeric values as milliseconds', () => {
        expect(apicache.getDuration(43)).toBe(43)
      })
      it('milliseconds', () => {
        expect(apicache.getDuration('3 ms')).toBe(3)
      })
      it('seconds', () => {
        expect(apicache.getDuration('3 seconds')).toBe(3000)
      })
      it('minutes', () => {
        expect(apicache.getDuration('4 minutes')).toBe(1000 * 60 * 4)
      })
      it('hours', () => {
        expect(apicache.getDuration('2 hours')).toBe(1000 * 60 * 60 * 2)
      })
      it('days', () => {
        expect(apicache.getDuration('3 days')).toBe(1000 * 60 * 60 * 24 * 3)
      })
      it('weeks', () => {
        expect(apicache.getDuration('5 weeks')).toBe(1000 * 60 * 60 * 24 * 7 * 5)
      })
      it('months', () => {
        expect(apicache.getDuration('6 months')).toBe(1000 * 60 * 60 * 24 * 30 * 6)
      })
    })
  })
})
