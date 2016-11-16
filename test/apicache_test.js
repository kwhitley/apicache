var chai = require('chai')
var expect = chai.expect
var request = require('supertest')
var apicache = require('../lib/apicache')
var pjson = require('../package.json')
var a = apicache.clone()
var b = apicache.clone()
var c = apicache.clone()

describe('.options(opt?) {GETTER/SETTER}', function() {
	var apicache = require('../lib/apicache.js')

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
	var apicache = require('../lib/apicache.js')

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
		it('years', function() {
			expect(apicache.getDuration('2 years')).to.equal(1000 * 60 * 60 * 24 * 365 * 2)
		})
	})

})

describe('.getIndex() {GETTER}', function() {
	var apicache = require('../lib/apicache.js')

	it('is a function', function() {
		expect(typeof apicache.getIndex).to.equal('function')
	})

	it('returns an object', function() {
		expect(typeof apicache.getIndex()).to.equal('object')
	})
})

describe('.resetIndex() {SETTER}', function() {
	var apicache = require('../lib/apicache.js')

	it('is a function', function() {
		expect(typeof apicache.resetIndex).to.equal('function')
	})

})

describe('.clear(key?) {SETTER}', function() {
	var apicache = require('../lib/apicache.js')

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

describe('.middleware {MIDDLEWARE}', function() {
	var apicache = require('../lib/apicache.js')

	it('is a function', function() {
		expect(typeof apicache.middleware).to.equal('function')
	})

	it('does not interfere with initial request', function(done) {
		var mockAPI = require('./mock_api')('10 seconds')

		request(mockAPI)
			.get('/api/movies')
			.end(function(err, res) {
				// console.log('res', mockAPI.apicache.id, mockAPI.apicache.getIndex())
				expect(mockAPI.requestsProcessed).to.equal(1)
				done()
			})
	})

	it('properly returns a cached request', function(done) {
		var mockAPI = require('./mock_api')('10 seconds')

		request(mockAPI)
			.get('/api/movies')
			.end(function(err, res1) {
				expect(res1.status).to.equal(200)
				expect(res1.body.length).to.equal(2)
				expect(mockAPI.requestsProcessed).to.equal(1)

				request(mockAPI)
					.get('/api/movies')
					.end(function(err, res2) {
						expect(res2.status).to.equal(200)
						expect(res2.body.length).to.equal(2)

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
						expect(res2.headers['apicache-version']).to.equal(pjson.version)
						expect(mockAPI.requestsProcessed).to.equal(1)
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
		}, 15)
	})

})
