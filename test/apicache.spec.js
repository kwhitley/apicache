const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')

describe(`apicache @ v${pkg.version}`, () => {
  it('loads the module without crashing', () => {
    expect(typeof apicache).toBe('object')
  })

  it('exposes a .middleware method', () => {
    expect(typeof apicache.middleware).toBe('function')
  })

  it('exposes a .options method', () => {
    expect(typeof apicache.options).toBe('function')
  })
})
