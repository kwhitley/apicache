var movies = [{
  title: 'The Prestige',
  director: 'Christopher Nolan',
},{
  title: 'Schindler\'s List',
  director: 'Steven Spielberg'
}]

var instances = []

function MockAPI(expiration, options) {
  // console.log('creating MockAPI with expiration in ' + expiration + ' with ApiCache config', options)
  var express = require('express')
  var compression = require('compression')
  var apicache = require('../src/apicache').newInstance(options)

  var app = express()
  app.use(compression({ threshold: 1 }))

  instances.push(this)

  this.apicache = apicache
  this.id = instances.length
  this.app = app

  // console.log('instantiating MockAPI:' + this.id + ' with expiration of ' + expiration)
  // console.log('this.id vs this.apicache.id', this.id, this.apicache.id)
  instances.forEach((instance, id) => {
    // console.log('instance id:apicache.id', instance.id, instance.apicache.id)
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
