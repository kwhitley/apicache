const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')
const request = require('supertest')

describe(`apicache @ v${pkg.version}`, () => {
  describe('.getIndex([groupName]) {GETTER}', () => {
    it('is a function', () => {
      expect(typeof apicache.getIndex).toBe('function')
    })

    it('returns an object', () => {
      expect(typeof apicache.getIndex()).toBe('object')
    })

    it('can clear indexed cache groups', () => {
      var api = require('./api/express')
      var app = api.create('10 seconds')

      return request(app)
        .get('/api/testcachegroup')
        .then(() => {
          expect(app.apicache.getIndex('cachegroup').length).toBe(1)
        })
    })
  })
})
