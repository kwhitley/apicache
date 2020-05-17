const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.options(opt?) {GETTER/SETTER}', function() {
    it('is a function', function() {
      expect(typeof apicache.options).toBe('function')
    })

    describe('.options() {GETTER}', function() {
      it('returns global options as object', function() {
        expect(typeof apicache.options()).toBe('object')
      })
    })

    describe('.options(opt) {SETTER}', function() {
      it('is chainable', function() {
        expect(apicache.options({})).toBe(apicache)
      })

      it('extends defaults', function() {
        expect(apicache.options({ foo: 'bar' }).options().foo).toBe('bar')
      })

      it('allows overrides of defaults', function() {
        var newDuration = 11

        expect(apicache.options()).toHaveProperty('defaultDuration')
        expect(apicache.options({ defaultDuration: newDuration }).options().defaultDuration).toBe(
          newDuration
        )
      })
    })
  })
})
