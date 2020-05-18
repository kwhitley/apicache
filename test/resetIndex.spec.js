const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.resetIndex() {SETTER}', () => {
    it('is a function', () => {
      expect(typeof apicache.resetIndex).toBe('function')
    })
  })
})
