var chai = require('chai')
var expect = chai.expect
var request = require('supertest')
var apicache = require('../src/apicache')
var pkg = require('../package.json')
var redis = require('fakeredis')
var a = apicache.clone()
var b = apicache.clone()
var c = apicache.clone()
var movies = require('./api/lib/data.json')

var apis = [
  { name: 'express', server: require('./api/express') },
  { name: 'express+gzip', server: require('./api/express-gzip') },

  // THESE TESTS ARE REMOVED AS RESTIFY 4 and 5 ARE CURRENTLY BREAKING IN THE ENVIRONMENT
  { name: 'restify', server: require('./api/restify') },
  { name: 'restify+gzip', server: require('./api/restify-gzip') }
]

function assertNumRequestsProcessed(app, n) {
  return function() {
    expect(app.requestsProcessed).to.equal(n)
  }
}

describe('.options(opt?) {GETTER/SETTER}', function() {
  var apicache = require('../src/apicache')

  it('is a function', function() {
    expect(typeof apicache.options).to.equal('function')
  })

  describe('.options() {GETTER}', function() {
    it ('returns global options as object', function() {
      expect(typeof apicache.options()).to.equal('object')
    })
  })

  describe('.options(opt) {SETTER}', function() {
    it ('is chainable', function() {
      expect(apicache.options({})).to.equal(apicache)
    })

    it ('extends defaults', function() {
      expect(apicache.options({ foo: 'bar' }).options().foo).to.equal('bar')
    })

    it ('allows overrides of defaults', function() {
      var newDuration = 11

      expect(apicache.options()).to.have.property('defaultDuration')
      expect(apicache.options({ defaultDuration: newDuration }).options().defaultDuration).to.equal(newDuration)
    })
  })
})

describe('.getDuration(stringOrNumber) {GETTER}', function() {
  var apicache = require('../src/apicache')

  it('is a function', function() {
    expect(typeof apicache.getDuration).to.equal('function')
  })

  it('returns value unchanged if numeric', function() {
    expect(apicache.getDuration(77)).to.equal(77)
  })

  it('returns default duration when uncertain', function() {
    apicache.options({ defaultDuration: 999 })
    expect(apicache.getDuration(undefined)).to.equal(999)
  })

  it('accepts singular or plural (e.g. "1 hour", "3 hours")', function() {
    expect(apicache.getDuration('3 seconds')).to.equal(3000)
    expect(apicache.getDuration('3 second')).to.equal(3000)
  })

  it('accepts decimals (e.g. "1.5 hours")', function() {
    expect(apicache.getDuration('1.5 seconds')).to.equal(1500)
  })

  describe('unit support', function() {
    it('numeric values as milliseconds', function() {
      expect(apicache.getDuration(43)).to.equal(43)
    })
    it('milliseconds', function() {
      expect(apicache.getDuration('3 ms')).to.equal(3)
    })
    it('seconds', function() {
      expect(apicache.getDuration('3 seconds')).to.equal(3000)
    })
    it('minutes', function() {
      expect(apicache.getDuration('4 minutes')).to.equal(1000 * 60 * 4)
    })
    it('hours', function() {
      expect(apicache.getDuration('2 hours')).to.equal(1000 * 60 * 60 * 2)
    })
    it('days', function() {
      expect(apicache.getDuration('3 days')).to.equal(1000 * 60 * 60 * 24 * 3)
    })
    it('weeks', function() {
      expect(apicache.getDuration('5 weeks')).to.equal(1000 * 60 * 60 * 24 * 7 * 5)
    })
    it('months', function() {
      expect(apicache.getDuration('6 months')).to.equal(1000 * 60 * 60 * 24 * 30 * 6)
    })
  })

})

describe('.getIndex([groupName]) {GETTER}', function() {
  var apicache = require('../src/apicache')

  it('is a function', function() {
    expect(typeof apicache.getIndex).to.equal('function')
  })

  it('returns an object', function() {
    expect(typeof apicache.getIndex()).to.equal('object')
  })

  it('can clear indexed cache groups', function() {
    var api = require('./api/express')
    var app = api.create('10 seconds')

    return request(app)
      .get('/api/testcachegroup')
      .then(function(res) {
        expect(app.apicache.getIndex('cachegroup').length).to.equal(1)
      })
  })
})

describe('.resetIndex() {SETTER}', function() {
  var apicache = require('../src/apicache')

  it('is a function', function() {
    expect(typeof apicache.resetIndex).to.equal('function')
  })

})

describe('.middleware {MIDDLEWARE}', function() {

  it('is a function', function() {
    var apicache = require('../src/apicache')
    expect(typeof apicache.middleware).to.equal('function')
    expect(apicache.middleware.length).to.equal(3)
  })

  it('returns the middleware function', function() {
    var middleware = require('../src/apicache').middleware('10 seconds')
    expect(typeof middleware).to.equal('function')
    expect(middleware.length).to.equal(3)
  })

  describe('options', function() {
    var apicache = require('../src/apicache').newInstance()

    it('uses global options if local ones not provided', function() {
      apicache.options({
        appendKey: ['test']
      })
      var middleware1 = apicache.middleware('10 seconds')
      var middleware2 = apicache.middleware('20 seconds')
      expect(middleware1.options()).to.eql({
        debug: false,
        defaultDuration: 3600000,
        enabled: true,
        appendKey: [ 'test' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: [] },
        events: { expire: undefined },
        headers: {}
      })
      expect(middleware2.options()).to.eql({
        debug: false,
        defaultDuration: 3600000,
        enabled: true,
        appendKey: [ 'test' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: [] },
        events: { expire: undefined },
        headers: {}
      })
    })

    it('uses local options if they provided', function() {
      apicache.options({
        appendKey: ['test']
      })
      var middleware1 = apicache.middleware('10 seconds', null, {
        debug: true,
        defaultDuration: 7200000,
        appendKey: ['bar'],
        statusCodes: { include: [], exclude: ['400'] },
        events: { expire: undefined },
        headers: {
          'cache-control': 'no-cache'
        }
      })
      var middleware2 = apicache.middleware('20 seconds', null, {
        debug: false,
        defaultDuration: 1800000,
        appendKey: ['foo'],
        statusCodes: { include: [], exclude: ['200'] },
        events: { expire: undefined },
      })
      expect(middleware1.options()).to.eql({
        debug: true,
        defaultDuration: 7200000,
        enabled: true,
        appendKey: [ 'bar' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: ['400'] },
        events: { expire: undefined },
        headers: {
          'cache-control': 'no-cache'
        }
      })
      expect(middleware2.options()).to.eql({
        debug: false,
        defaultDuration: 1800000,
        enabled: true,
        appendKey: [ 'foo' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: ['200'] },
        events: { expire: undefined },
        headers: {}
      })
    })

    it('updates options if global ones changed', function() {
      apicache.options({
        debug: true,
        appendKey: ['test']
      })
      var middleware1 = apicache.middleware('10 seconds', null, {
        defaultDuration: 7200000,
        statusCodes: { include: [], exclude: ['400'] }
      })
      var middleware2 = apicache.middleware('20 seconds', null, {
        defaultDuration: 1800000,
        statusCodes: { include: [], exclude: ['200'] }
      })
      apicache.options({
        debug: false,
        appendKey: ['foo']
      })
      expect(middleware1.options()).to.eql({
        debug: false,
        defaultDuration: 7200000,
        enabled: true,
        appendKey: [ 'foo' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: ['400'] },
        events: { expire: undefined },
        headers: {}
      })
      expect(middleware2.options()).to.eql({
        debug: false,
        defaultDuration: 1800000,
        enabled: true,
        appendKey: [ 'foo' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: ['200'] },
        events: { expire: undefined },
        headers: {}
      })
    })

    it('updates options if local ones changed', function() {
      apicache.options({
        debug: true,
        appendKey: ['test']
      })
      var middleware1 = apicache.middleware('10 seconds', null, {
        defaultDuration: 7200000,
        statusCodes: { include: [], exclude: ['400'] }
      })
      var middleware2 = apicache.middleware('20 seconds', null, {
        defaultDuration: 900000,
        statusCodes: { include: [], exclude: ['404'] }
      })
      middleware1.options({
        debug: false,
        defaultDuration: 1800000,
        appendKey: ['foo'],
        headers: {
          'cache-control': 'no-cache'
        }
      })
      middleware2.options({
        defaultDuration: 450000,
        enabled: false,
        appendKey: ['foo']
      })
      expect(middleware1.options()).to.eql({
        debug: false,
        defaultDuration: 1800000,
        enabled: true,
        appendKey: [ 'foo' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: [] },
        events: { expire: undefined },
        headers: {
          'cache-control': 'no-cache'
        }
      })
      expect(middleware2.options()).to.eql({
        debug: true,
        defaultDuration: 450000,
        enabled: false,
        appendKey: [ 'foo' ],
        jsonp: false,
        redisClient: false,
        headerBlacklist: [],
        statusCodes: { include: [], exclude: [] },
        events: { expire: undefined },
        headers: {}
      })
    })
  })

  apis.forEach(function(api) {
    describe(api.name + ' tests', function() {
      var mockAPI = api.server

      it('does not interfere with initial request', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200)
          .then(assertNumRequestsProcessed(app, 1))
      })

      it('properly returns a request while caching (first call)', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(assertNumRequestsProcessed(app, 1))
      })

      it('skips cache when using header "x-apicache-bypass"', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(assertNumRequestsProcessed(app, 1))
          .then(function() {
            return request(app)
              .get('/api/movies')
              .set('x-apicache-bypass', true)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200, movies)
              .then(function(res) {
                expect(res.headers['apicache-store']).to.be.undefined
                expect(res.headers['apicache-version']).to.be.undefined
                expect(app.requestsProcessed).to.equal(2)
              })
          })
      })

      it('skips cache when using header "x-apicache-force-fetch (legacy)"', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(assertNumRequestsProcessed(app, 1))
          .then(function() {
            return request(app)
              .get('/api/movies')
              .set('x-apicache-force-fetch', true)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200, movies)
              .then(function(res) {
                expect(res.headers['apicache-store']).to.be.undefined
                expect(res.headers['apicache-version']).to.be.undefined
                expect(app.requestsProcessed).to.equal(2)
              })
          })
      })

      it('does not cache header in headerBlacklist', function() {
        var app = mockAPI.create('10 seconds', {headerBlacklist: ['x-blacklisted']})

        return request(app)
          .get('/api/testheaderblacklist')
          .expect(200, movies)
          .then(function(res) {
            expect(res.headers['x-blacklisted']).to.equal(res.headers['x-notblacklisted'])
            return request(app)
              .get('/api/testheaderblacklist')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200, movies)
              .then(function(res2) {
                expect(res2.headers['x-blacklisted']).to.not.equal(res2.headers['x-notblacklisted'])
              })
          })
      })

      it('properly returns a cached JSON request', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(assertNumRequestsProcessed(app, 1))
          .then(function() {
            return request(app)
              .get('/api/movies')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200, movies)
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('properly uses appendKey params', function() {
        var app = mockAPI.create('10 seconds', { appendKey: ['method'] })

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(function() {
            expect(app.apicache.getIndex().all[0]).to.equal('/api/movies$$appendKey=GET')
          })
      })

      it('properly uses custom appendKey(req, res) function', function() {
        var appendKey = function(req, res) {
          return req.method + res.id
        }
        var app = mockAPI.create('10 seconds', { appendKey: appendKey })

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(function() {
            expect(app.apicache.getIndex().all[0]).to.equal('/api/movies$$appendKey=GET123')
          })
      })

      it('returns cached response from write+end', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/writeandend')
          .expect(200, 'abc')
          .expect('Cache-Control', 'max-age=10')
          .then(assertNumRequestsProcessed(app, 1))
          .then(function() {
            return request(app)
              .get('/api/writeandend')
              .expect(200, 'abc')
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('returns cached response from write Buffer+end', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/writebufferandend')
          .expect(200, 'abc')
          .expect('Cache-Control', 'max-age=10')
          .then(assertNumRequestsProcessed(app, 1))
          .then(function() {
            return request(app)
              .get('/api/writebufferandend')
              .expect(200, 'abc')
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('embeds store type and apicache version in cached responses', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(function(res) {
            expect(res.headers['apicache-store']).to.be.undefined
            expect(res.headers['apicache-version']).to.be.undefined
            expect(app.requestsProcessed).to.equal(1)
          })
          .then(function() {
            return request(app)
              .get('/api/movies')
              .expect('apicache-store', 'memory')
              .expect('apicache-version', pkg.version)
              .expect(200, movies)
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('embeds cache-control header', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect('Cache-Control', 'max-age=10')
          .expect(200, movies)
          .then(function(res) {
            expect(res.headers['apicache-store']).to.be.undefined
            expect(res.headers['apicache-version']).to.be.undefined
            expect(app.requestsProcessed).to.equal(1)
            expect(res.headers['date']).to.exist
          })
          .then(function() {
            return request(app)
              .get('/api/movies')
              .expect('apicache-store', 'memory')
              .expect('apicache-version', pkg.version)
              .expect(200, movies)
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('allows cache-control header to be overwritten (e.g. "no-cache"', function() {
        var app = mockAPI.create('10 seconds', { headers: { 'cache-control': 'no-cache' }})

        return request(app)
          .get('/api/movies')
          .expect('Cache-Control', 'no-cache')
          .expect(200, movies)
          .then(function(res) {
            expect(res.headers['apicache-store']).to.be.undefined
            expect(res.headers['apicache-version']).to.be.undefined
            expect(app.requestsProcessed).to.equal(1)
            expect(res.headers['date']).to.exist
          })
          .then(function() {
            return request(app)
              .get('/api/movies')
              .expect('apicache-store', 'memory')
              .expect('apicache-version', pkg.version)
              .expect(200, movies)
              .then(assertNumRequestsProcessed(app, 1))
          })
      })

      it('preserves etag header', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200)
          .then(function(res) {
            var etag = res.headers['etag']
            expect(etag).to.exist
            return etag
          })
          .then(function(etag) {
            return request(app)
              .get('/api/movies')
              .expect(200)
              .expect('etag', etag)
          })
      })

      it('respects if-none-match header', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200)
          .then(function(res) {
            return res.headers['etag']
          })
          .then(function(etag) {
            return request(app)
              .get('/api/movies')
              .set('if-none-match', etag)
              .expect(304)
              .expect('etag', etag)
          })
      })

      it('embeds returns content-type JSON from original response and cached response', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .expect(200)
          .expect('Content-Type', 'application/json; charset=utf-8')
          .then(function() {
            return request(app)
              .get('/api/movies')
              .expect('Content-Type', 'application/json; charset=utf-8')
          })
      })

      it('does not cache a request when status code found in status code exclusions', function() {
        var app = mockAPI.create('2 seconds', {
          statusCodes: { exclude: [404] }
        })

        return request(app)
          .get('/api/missing')
          .expect(404)
          .then(function(res) {
            expect(res.headers['cache-control']).to.equal('no-cache, no-store, must-revalidate')
            expect(app.apicache.getIndex().all.length).to.equal(0)
          })
      })

      it('does not cache a request when status code not found in status code inclusions', function() {
        var app = mockAPI.create('2 seconds', {
          statusCodes: { include: [200] }
        })

        return request(app)
          .get('/api/missing')
          .expect(404)
          .then(function(res) {
            expect(res.headers['cache-control']).to.equal('no-cache, no-store, must-revalidate')
            expect(app.apicache.getIndex().all.length).to.equal(0)
          })
      })

      it('middlewareToggle works correctly to control statusCode caching (per example)', function() {
        var onlyStatusCode200 = function(req, res) {
          return res.statusCode === 200
        }

        var app = mockAPI.create('2 seconds', {}, onlyStatusCode200)

        return request(app)
          .get('/api/missing')
          .expect(404)
          .then(function(res) {
            expect(res.headers['cache-control']).to.equal('no-cache, no-store, must-revalidate')
            expect(app.apicache.getIndex().all.length).to.equal(0)
          })
      })

      it('removes a cache key after expiration', function(done) {
        var app = mockAPI.create(10)

        request(app)
          .get('/api/movies')
          .end(function(err, res) {
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().all).to.include('/api/movies')
          })

        setTimeout(function() {
          expect(app.apicache.getIndex().all).to.have.length(0)
          done()
        }, 25)
      })

      it('executes expiration callback from globalOptions.events.expire upon entry expiration', function(done) {
        var callbackResponse = undefined
        var cb = function(a,b) {
          callbackResponse = b
        }
        var app = mockAPI.create(10, { events: { expire: cb }})

        request(app)
          .get('/api/movies')
          .end(function(err, res) {
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().all).to.include('/api/movies')
          })

        setTimeout(function() {
          expect(app.apicache.getIndex().all).to.have.length(0)
          expect(callbackResponse).to.equal('/api/movies')
          done()
        }, 25)
      })

      it('clearing cache cancels expiration callback', function(done) {
        var app = mockAPI.create(20)

        request(app)
            .get('/api/movies')
            .end(function(err, res) {
              expect(app.apicache.getIndex().all.length).to.equal(1)
              expect(app.apicache.clear('/api/movies').all.length).to.equal(0)
            })

        setTimeout(function() {
          request(app)
              .get('/api/movies')
              .end(function(err, res) {
                expect(app.apicache.getIndex().all.length).to.equal(1)
                expect(app.apicache.getIndex().all).to.include('/api/movies')
              })
        }, 10)

        setTimeout(function() {
          expect(app.apicache.getIndex().all.length).to.equal(1)
          expect(app.apicache.getIndex().all).to.include('/api/movies')
          done()
        }, 25)
      })

      it('allows defaultDuration to be a parseable string (e.g. "1 week")', function(done) {
        var callbackResponse = undefined
        var cb = function(a,b) {
          callbackResponse = b
        }
        var app = mockAPI.create(null, { defaultDuration: '10ms', events: { expire: cb }})

        request(app)
          .get('/api/movies')
          .end(function(err, res) {
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().all).to.include('/api/movies')
          })

        setTimeout(function() {
          expect(app.apicache.getIndex().all).to.have.length(0)
          expect(callbackResponse).to.equal('/api/movies')
          done()
        }, 25)
      })
    })
  })
})

describe('Redis support', function() {

  function hgetallIsNull(db, key) {
    return new Promise(function(resolve, reject) {
      db.hgetall(key, function(err, reply) {
        if(err) {
          reject(err)
        } else {
          expect(reply).to.equal(null)
          db.flushdb()
          resolve()
        }
      })
    })
  }

  apis.forEach(function(api) {
    describe(api.name + ' tests', function() {
      var mockAPI = api.server

      it('properly caches a request', function() {
        var db = redis.createClient()
        var app = mockAPI.create('10 seconds', { redisClient: db })

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
          .then(function(res) {
            expect(res.headers['apicache-store']).to.be.undefined
            expect(res.headers['apicache-version']).to.be.undefined
            expect(app.requestsProcessed).to.equal(1)
          })
          .then(function() {
            return request(app)
              .get('/api/movies')
              .expect(200, movies)
              .expect('apicache-store', 'redis')
              .expect('apicache-version', pkg.version)
              .then(assertNumRequestsProcessed(app, 1))
              .then(function() {
                db.flushdb()
              })
          })
      })

      it('can clear indexed cache groups', function() {
        var db = redis.createClient()
        var app = mockAPI.create('10 seconds', { redisClient: db })

        return request(app)
          .get('/api/testcachegroup')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().groups.cachegroup.length).to.equal(1)
            expect(Object.keys(app.apicache.clear('cachegroup').groups).length).to.equal(0)
            expect(app.apicache.getIndex().all.length).to.equal(0)
            return hgetallIsNull(db, '/api/testcachegroup')
          })
      })

      it('can clear indexed entries by url/key (non-group)', function() {
        var db = redis.createClient()
        var app = mockAPI.create('10 seconds', { redisClient: db })

       return request(app)
          .get('/api/movies')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.clear('/api/movies').all.length).to.equal(0)
            return hgetallIsNull(db, '/api/movies')
          })
      })

      it('can clear all entries from index', function() {
        var db = redis.createClient()
        var app = mockAPI.create('10 seconds', { redisClient: db })

        expect(app.apicache.getIndex().all.length).to.equal(0)
        expect(app.apicache.clear().all.length).to.equal(0)

        return request(app)
          .get('/api/movies')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.clear().all.length).to.equal(0)
            return hgetallIsNull(db, '/api/movies')
          })
      })

      it('sends a response even if redis failure', function() {
        var app = mockAPI.create('10 seconds', { redisClient: {} })

        return request(app)
          .get('/api/movies')
          .expect(200, movies)
      })
    })
  })
})

describe('.clear(key?) {SETTER}', function() {

  it('is a function', function() {
    var apicache = require('../src/apicache')
    expect(typeof apicache.clear).to.equal('function')
  })

  apis.forEach(function(api) {
    describe(api.name + ' tests', function() {
      var mockAPI = api.server

      it('works when called with group key', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/testcachegroup')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().groups.cachegroup.length).to.equal(1)
            expect(Object.keys(app.apicache.clear('cachegroup').groups).length).to.equal(0)
            expect(app.apicache.getIndex().all.length).to.equal(0)
          })
      })

      it('works when called with specific endpoint (non-group) key', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/movies')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.clear('/api/movies').all.length).to.equal(0)
          })
      })

      it('clears empty group after removing last specific endpoint', function() {
        var app = mockAPI.create('10 seconds')

        return request(app)
          .get('/api/testcachegroup')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.getIndex().groups.cachegroup.length).to.equal(1)
            expect(Object.keys(app.apicache.clear('/api/testcachegroup').groups).length).to.equal(0)
            expect(app.apicache.getIndex().all.length).to.equal(0)
          })
      })

      it('works when called with no key', function() {
        var app = mockAPI.create('10 seconds')

        expect(app.apicache.getIndex().all.length).to.equal(0)
        expect(app.apicache.clear().all.length).to.equal(0)
        return request(app)
          .get('/api/movies')
          .then(function(res) {
            expect(app.requestsProcessed).to.equal(1)
            expect(app.apicache.getIndex().all.length).to.equal(1)
            expect(app.apicache.clear().all.length).to.equal(0)
          })
      })

    })
  })
})
