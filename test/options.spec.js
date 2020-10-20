const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.options(opt?) {GETTER/SETTER}', () => {
    it('is a function', () => {
      expect(typeof apicache.options).toBe('function')
    })

    describe('.options() {GETTER}', () => {
      it('returns global options as object', () => {
        expect(typeof apicache.options()).toBe('object')
      })
    })

    describe('.options(opt) {SETTER}', () => {
      it('is chainable', () => {
        expect(apicache.options({})).toBe(apicache)
      })

      it('extends defaults', () => {
        expect(apicache.options({ foo: 'bar' }).options().foo).toBe('bar')
      })

      it('allows overrides of defaults', () => {
        var newDuration = 11

        expect(apicache.options()).toHaveProperty('defaultDuration')
        expect(apicache.options({ defaultDuration: newDuration }).options().defaultDuration).toBe(
          newDuration
        )
      })
    })
  })
})
