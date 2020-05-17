const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.getDuration(stringOrNumber) {GETTER}', function() {
    it('is a function', function() {
      expect(typeof apicache.getDuration).toBe('function')
    })

    it('returns value unchanged if numeric', function() {
      expect(apicache.getDuration(77)).toBe(77)
    })

    it('returns default duration when uncertain', function() {
      apicache.options({ defaultDuration: 999 })
      expect(apicache.getDuration(undefined)).toBe(999)
    })

    it('accepts singular or plural (e.g. "1 hour", "3 hours")', function() {
      expect(apicache.getDuration('3 seconds')).toBe(3000)
      expect(apicache.getDuration('3 second')).toBe(3000)
    })

    it('accepts decimals (e.g. "1.5 hours")', function() {
      expect(apicache.getDuration('1.5 seconds')).toBe(1500)
    })

    describe('unit support', function() {
      it('numeric values as milliseconds', function() {
        expect(apicache.getDuration(43)).toBe(43)
      })
      it('milliseconds', function() {
        expect(apicache.getDuration('3 ms')).toBe(3)
      })
      it('seconds', function() {
        expect(apicache.getDuration('3 seconds')).toBe(3000)
      })
      it('minutes', function() {
        expect(apicache.getDuration('4 minutes')).toBe(1000 * 60 * 4)
      })
      it('hours', function() {
        expect(apicache.getDuration('2 hours')).toBe(1000 * 60 * 60 * 2)
      })
      it('days', function() {
        expect(apicache.getDuration('3 days')).toBe(1000 * 60 * 60 * 24 * 3)
      })
      it('weeks', function() {
        expect(apicache.getDuration('5 weeks')).toBe(1000 * 60 * 60 * 24 * 7 * 5)
      })
      it('months', function() {
        expect(apicache.getDuration('6 months')).toBe(1000 * 60 * 60 * 24 * 30 * 6)
      })
    })
  })
})
