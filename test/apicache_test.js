var chai = require('chai');
var expect = chai.expect;
var request = require('supertest');

describe('.options(opt?) {GETTER/SETTER}', function() {
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.options).to.equal('function');
  });
  
  describe('.options() {GETTER}', function() {
    it ('returns global options as object', function() {
      expect(typeof apicache.options()).to.equal('object');
    });
  });

  describe('.options(opt) {SETTER}', function() {
    it ('is chainable', function() {
      expect(apicache.options({})).to.equal(apicache);
    });
     
    it ('extends defaults', function() {
      expect(apicache.options({ foo: 'bar' }).options().foo).to.equal('bar');
    });

    it ('allows overrides of defaults', function() {
      var newDuration = 10;

      expect(apicache.options()).to.have.property('defaultDuration');
      expect(apicache.options({ defaultDuration: newDuration }).options().defaultDuration).to.equal(newDuration);
    });
  });

});

describe('.getIndex() {GETTER}', function() {
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.getIndex).to.equal('function');
  });
  
  it('returns an object', function() {
    expect(typeof apicache.getIndex()).to.equal('object');
  });

});

describe('.resetIndex() {SETTER}', function() {
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.resetIndex).to.equal('function');
  });

});

describe('.clear(key?) {SETTER}', function() {
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.clear).to.equal('function');
  });

});

describe('.middleware {MIDDLEWARE}', function() {
  var mockAPI = require('./mock_api')('2 seconds');
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.middleware).to.equal('function');
  });

  it('does not interfere with initial request', function(done) {
    request(mockAPI)
      .get('/api/movies')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        done();
      });
  });

  it('caches a request', function(done) {
    request(mockAPI)
      .get('/api/movies')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        expect(mockAPI.requestsProcessed).to.equal(1);
        done();
      });
  });

  it('injects a cache key', function() {
    expect(apicache.getIndex().all).to.include('/api/movies');
    // setTimeout(function() {

    // }, 5);
  });

  it('removes a cache key after expiration', function(done) {
    this.timeout(5000);
    setTimeout(function() {
      expect(apicache.getIndex().all).to.have.length(0);
      done();
    }, 2000);
  });
  
});
