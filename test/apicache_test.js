var chai = require('chai')
var expect = chai.expect
var request = require('supertest')
var apicache = require('../src/apicache')
var pkg = require('../package.json')
var redis = require('redis')
var a = apicache.clone()
var b = apicache.clone()
var c = apicache.clone()

describe('.options(opt?) {GETTER/SETTER}', function() {
  var apicache = require('../src/apicache.js')

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
  var apicache = require('../src/apicache.js')

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

describe('.getIndex() {GETTER}', function() {
  var apicache = require('../src/apicache.js')

  it('is a function', function() {
    expect(typeof apicache.getIndex).to.equal('function')
  })

  it('returns an object', function() {
    expect(typeof apicache.getIndex()).to.equal('object')
  })
})

describe('.resetIndex() {SETTER}', function() {
  var apicache = require('../src/apicache.js')

  it('is a function', function() {
    expect(typeof apicache.resetIndex).to.equal('function')
  })

})

describe('.middleware {MIDDLEWARE}', function() {
  var apicache = require('../src/apicache.js')

  it('is a function', function() {
    expect(typeof apicache.middleware).to.equal('function')
  })

  it('does not interfere with initial request', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        done()
      })
  })

  it('properly returns a request while caching (first call)', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(mockAPI.requestsProcessed).to.equal(1)
        done()
      })
  })

  it('properly returns a cached JSON request', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/movies')
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.body.length).to.equal(2)
            expect(res2.body[0].title).to.equal('The Prestige')

            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('properly returns a cached JSON request when gzipped', function(done) {
    var mockAPI = require('./mock_api_gzip')('10 seconds')

    request(mockAPI)
      .get('/api/gzip/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/gzip/movies')
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.body.length).to.equal(2)
            expect(res2.body[0].title).to.equal('The Prestige')

            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('returns cached response from write+end', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/writeandend')
      .end(function(err, res1, body) {
        expect(res1.status).to.equal(200)
        expect(res1.text).to.equal('abc')
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/writeandend')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.text).to.equal('abc')

            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('returns cached response from write+end when gzipped', function(done) {
    var mockAPI = require('./mock_api_gzip')('10 seconds')

    request(mockAPI)
      .get('/api/gzip/writeandend')
      .end(function(err, res1, body) {
        expect(res1.status).to.equal(200)
        expect(res1.text).to.equal('abc')
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/gzip/writeandend')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.text).to.equal('abc')

            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('embeds store type and apicache version in cached responses', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(res1.headers['apicache-store']).to.equal(undefined)
        expect(res1.headers['apicache-version']).to.equal(undefined)
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/movies')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.body.length).to.equal(2)
            expect(res2.headers['apicache-store']).to.equal('memory')
            expect(res2.headers['apicache-version']).to.equal(pkg.version)
            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('embeds cache-control header', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(res1.headers['apicache-store']).to.equal(undefined)
        expect(res1.headers['apicache-version']).to.equal(undefined)
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(res1.headers['cache-control'].indexOf('max-age=10') !== -1).to.equal(true)
        expect(res1.headers['date'] !== undefined).to.equal(true)

        request(mockAPI)
          .get('/api/movies')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.body.length).to.equal(2)
            expect(res2.headers['apicache-store']).to.equal('memory')
            expect(res2.headers['apicache-version']).to.equal(pkg.version)
            expect(res2.headers['cache-control'].indexOf('max-age=10') !== -1).to.equal(true)
            expect(mockAPI.requestsProcessed).to.equal(1)
            done()
          })
      })
  })

  it('preserves etag header', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        var etag = res1.headers['etag']
        expect(etag !== undefined).to.equal(true)

        request(mockAPI)
          .get('/api/movies')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.headers['etag']).to.equal(etag)
            done()
          })
      })
  })

  it('embeds returns content-type JSON from original response and cached response', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.headers['content-type']).to.equal('application/json; charset=utf-8')

        request(mockAPI)
          .get('/api/movies')
          .expect('Content-Type', 'application/json; charset=utf-8', done)
      })
  })

  it('does not cache a request when status code found in status code exclusions', function(done) {
    var mockAPI = require('./mock_api')('2 seconds', {
      statusCodes: { exclude: [404] }
    })

    request(mockAPI)
      .get('/api/missing')
      .end(function(err, res) {
        expect(res.statusCode).to.equal(404)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
        done()
      })
  })

  it('does not cache a request when status code not found in status code inclusions', function(done) {
    var mockAPI = require('./mock_api')('2 seconds', {
      statusCodes: { include: [200] }
    })

    request(mockAPI)
      .get('/api/missing')
      .end(function(err, res) {
        expect(res.statusCode).to.equal(404)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
        done()
      })
  })

  it('removes a cache key after expiration', function(done) {
    var mockAPI = require('./mock_api')(10)
    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.getIndex().all).to.include('/api/movies')
      })

    setTimeout(function() {
      expect(mockAPI.apicache.getIndex().all).to.have.length(0)
      done()
    }, 25)
  })

})

describe('Redis support', function() {
  it('properly caches a request', function(done) {
    var db = redis.createClient()
    var mockAPI = require('./mock_api')('10 seconds', { redisClient: db })

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res1) {
        expect(res1.status).to.equal(200)
        expect(res1.body.length).to.equal(2)
        expect(res1.headers['apicache-store']).to.equal(undefined)
        expect(res1.headers['apicache-version']).to.equal(undefined)
        expect(mockAPI.requestsProcessed).to.equal(1)

        request(mockAPI)
          .get('/api/movies')
          .end(function(err, res2) {
            expect(res2.status).to.equal(200)
            expect(res2.body.length).to.equal(2)
            expect(res2.headers['apicache-store']).to.equal('redis')
            expect(res2.headers['apicache-version']).to.equal(pkg.version)
            expect(mockAPI.requestsProcessed).to.equal(1)
            db.flushdb()
            done()
          })
      })
  })

  it('can clear indexed cache groups', function(done) {
    var db = redis.createClient()
    var mockAPI = require('./mock_api')('10 seconds', { redisClient: db })

    request(mockAPI)
      .get('/api/testcachegroup')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.getIndex().groups.cachegroup.length).to.equal(1)
        expect(Object.keys(mockAPI.apicache.clear('cachegroup').groups).length).to.equal(0)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
        db.hgetall('/api/testcachegroup', function(err, reply) {
          expect(reply).to.equal(null)
          db.flushdb()
          done()
        })
      })
  })

  it('can clear indexed entries by url/key (non-group)', function(done) {
    var db = redis.createClient()
    var mockAPI = require('./mock_api')('10 seconds', { redisClient: db })

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.clear('/api/movies').all.length).to.equal(0)
        db.hgetall('/api/movies', function(err, reply) {
          expect(reply).to.equal(null)
          db.flushdb()
          done()
        })
      })
  })

  it('can clear all entries from index', function(done) {
    var db = redis.createClient()
    var mockAPI = require('./mock_api')('10 seconds', { redisClient: db })

    expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
    expect(mockAPI.apicache.clear().all.length).to.equal(0)
    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.clear().all.length).to.equal(0)
        db.hgetall('/api/movies', function(err, reply) {
          expect(reply).to.equal(null)
          db.flushdb()
          done()
        })
      })
  })
})

describe('.clear(key?) {SETTER}', function() {
  var apicache = require('../src/apicache.js')

  it('is a function', function() {
    expect(typeof apicache.clear).to.equal('function')
  })

  it('works when called with group key', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/testcachegroup')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.getIndex().groups.cachegroup.length).to.equal(1)
        expect(Object.keys(mockAPI.apicache.clear('cachegroup').groups).length).to.equal(0)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
        done()
      })
  })

  it('works when called with specific endpoint (non-group) key', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.clear('/api/movies').all.length).to.equal(0)
        done()
      })
  })

  it('clears empty group after removing last specific endpoint', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    request(mockAPI)
      .get('/api/testcachegroup')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.getIndex().groups.cachegroup.length).to.equal(1)
        expect(Object.keys(mockAPI.apicache.clear('/api/testcachegroup').groups).length).to.equal(0)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
        done()
      })
  })

  it('works when called with no key', function(done) {
    var mockAPI = require('./mock_api')('10 seconds')

    expect(mockAPI.apicache.getIndex().all.length).to.equal(0)
    expect(mockAPI.apicache.clear().all.length).to.equal(0)
    request(mockAPI)
      .get('/api/movies')
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1)
        expect(mockAPI.apicache.getIndex().all.length).to.equal(1)
        expect(mockAPI.apicache.clear().all.length).to.equal(0)
        done()
      })
  })
})
