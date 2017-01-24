var express = require('express')
var compression = require('compression')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options) {
  var apicache = require('../../src/apicache').newInstance(options)
  var app = express()

  // ENABLE COMPRESSION
  app.use(compression({ threshold: 1 }))

  // ENABLE APICACHE
  app.use(apicache.middleware(expiration))
  app.apicache = apicache

  // ADD API ROUTES
  app = addRoutes(app)

  return app
}

module.exports = {
  create: function(expiration, config) { return new MockAPI(expiration, config) }
}
