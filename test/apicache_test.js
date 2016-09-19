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
      var newDuration = 11;

      expect(apicache.options()).to.have.property('defaultDuration');
      expect(apicache.options({ defaultDuration: newDuration }).options().defaultDuration).to.equal(newDuration);
    });
  });
});

describe('.getDuration(stringOrNumber) {GETTER}', function() {
  var apicache = require('../lib/apicache.js');

  it('is a function', function() {
    expect(typeof apicache.getDuration).to.equal('function');
  });
  
  it('returns value unchanged if numeric', function() {
    expect(apicache.getDuration(77)).to.equal(77);
  });

  it('returns default duration when uncertain', function() {
    apicache.options({ defaultDuration: 999 });
    expect(apicache.getDuration(undefined)).to.equal(999);
  });

  it('accepts singular or plural (e.g. "1 hour", "3 hours")', function() {
    expect(apicache.getDuration('3 seconds')).to.equal(3000);
    expect(apicache.getDuration('3 second')).to.equal(3000);
  });

  it('accepts decimals (e.g. "1.5 hours")', function() {
    expect(apicache.getDuration('1.5 seconds')).to.equal(1500);
  });

  describe('unit support', function() {
    it('seconds', function() {
      expect(apicache.getDuration('3 seconds')).to.equal(3000);
    });
    it('minutes', function() {
      expect(apicache.getDuration('4 minutes')).to.equal(1000 * 60 * 4);
    });
    it('hours', function() {
      expect(apicache.getDuration('2 hours')).to.equal(1000 * 60 * 60 * 2);
    });
    it('days', function() {
      expect(apicache.getDuration('3 days')).to.equal(1000 * 60 * 60 * 24 * 3);
    });
    it('weeks', function() {
      expect(apicache.getDuration('5 weeks')).to.equal(1000 * 60 * 60 * 24 * 7 * 5);
    });
    it('months', function() {
      expect(apicache.getDuration('6 months')).to.equal(1000 * 60 * 60 * 24 * 30 * 6);
    });
    it('years', function() {
      expect(apicache.getDuration('2 years')).to.equal(1000 * 60 * 60 * 24 * 365 * 2);
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
  var mockAPI = require('./mock_api')('1 second');
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
  });

  it('removes a cache key after expiration', function(done) {
    this.timeout(5000);
    setTimeout(function() {
      expect(apicache.getIndex().all).to.have.length(0);
      done();
    }, 1001);
  });
  
});
