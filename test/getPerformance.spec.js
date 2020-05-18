const apicache = require('../dist/main/apicache')
const pkg = require('../package.json')
const request = require('supertest')

const basePerformance = {
  callCount: 0,
  hitCount: 0,
  missCount: 0,
  hitRate: null,
  hitRateLast100: null,
  hitRateLast1000: null,
  hitRateLast10000: null,
  hitRateLast100000: null,
  lastCacheHit: null,
  lastCacheMiss: null,
}

describe(`apicache @ v${pkg.version}`, () => {
  describe('.getPerformance()', () => {
    it('is a function', () => {
      expect(typeof apicache.getPerformance).toBe('function')
    })

    it('returns an array', () => {
      expect(Array.isArray(apicache.getPerformance())).toBe(true)
    })

    it('returns a null hit rate if the api has not been called', () => {
      var api = require('./api/express')
      var app = api.create('10 seconds', { trackPerformance: true })
      expect(app.apicache.getPerformance()[0]).toMatchObject(basePerformance)
    })

    it('returns a 0 hit rate if the api has been called once', () => {
      var api = require('./api/express')
      var app = api.create('10 seconds', { trackPerformance: true })

      return request(app)
        .get('/api/movies')
        .then(function (res) {
          expect(app.apicache.getPerformance()[0]).toMatchObject({
            ...basePerformance,
            callCount: 1,
            missCount: 1,
            hitRate: 0,
            hitRateLast100: 0,
            hitRateLast1000: 0,
            hitRateLast10000: 0,
            hitRateLast100000: 0,
            lastCacheMiss: '/api/movies',
          })
        })
    })

    it('returns a 0.5 hit rate if the api has been called twice', () => {
      var api = require('./api/express')
      var app = api.create('10 seconds', { trackPerformance: true })
      var requests = []
      for (var i = 0; i < 2; i++) {
        requests.push(request(app).get('/api/movies'))
      }
      return Promise.all(requests).then(() => {
        expect(app.apicache.getPerformance()[0]).toMatchObject({
          callCount: 2,
          hitCount: 1,
          missCount: 1,
          hitRate: 0.5,
          hitRateLast100: 0.5,
          hitRateLast1000: 0.5,
          hitRateLast10000: 0.5,
          hitRateLast100000: 0.5,
          lastCacheHit: '/api/movies',
          lastCacheMiss: '/api/movies',
        })
      })
    })
  })
})
