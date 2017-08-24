var movies = [{
  title: 'The Prestige',
  director: 'Christopher Nolan',
},{
  title: 'Schindler\'s List',
  director: 'Steven Spielberg'
}]

var instances = []

function MockAPI(expiration, options) {
  var restify = require('restify')
  var apicache = require('../src/apicache').newInstance(options)

  var app = restify.createServer();

  app.use(restify.gzipResponse());

  instances.push(this)

  this.apicache = apicache
  this.id = instances.length
  this.app = app

  instances.forEach(function(instance, id) {
    if (instance.id !== this.id && this.apicache === instance.apicache) {
      console.log('WARNING: SHARED APICACHE INSTANCE', id, this.id, this.apicache.id, instance.apicache.id)
    }
    if (instance.id !== this.id && this.app === instance.app) {
      console.log('WARNING: SHARED EXPRESS INSTANCE', id, this.id)
    }
  })

  app.use(this.apicache.middleware(expiration))

  app.get('/api/gzip/movies', function(req, res) {
    app.requestsProcessed++

    res.json(movies)
  })

  app.get('/api/gzip/writeandend', function(req, res) {
    app.requestsProcessed++

    res.write('a')
    res.write('b')
    res.write('c')

    res.end()
  })

  app.apicache = apicache
  app.requestsProcessed = 0

  return app
}

module.exports = {
  create: function(expiration, config) { return new MockAPI(expiration, config) }
};
