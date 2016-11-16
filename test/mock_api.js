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
  var apicache = require('../lib/apicache').newInstance(options)

  var app = express()

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

  app.get('/api/movies', function(req, res) {
    app.requestsProcessed++

    res.json(movies)
  })

  app.get('/api/testcachegroup', function(req, res) {
    app.requestsProcessed++
    req.apicacheGroup = 'cachegroup'

    res.json(movies)
  })

  app.get('/api/text', function(req, res) {
    app.requestsProcessed++

    res.send('plaintext')
  })

  app.get('/api/html', function(req, res) {
    app.requestsProcessed++

    res.send('<html>')
  })

  app.get('/api/missing', function(req, res) {
    app.requestsProcessed++

    res.status(404).json({ success: false, message: 'Resource not found' })
  })

  app.get('/api/movies/:index', function(req, res) {
    app.requestsProcessed++

    res.json(movies[index])
  })

  app.apicache = apicache
  app.requestsProcessed = 0

  return app
}

module.exports = function(expiration, config) { return new MockAPI(expiration, config) }
