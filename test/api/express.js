var express = require('express')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options) {
  var apicache = require('../../src/apicache').newInstance(options)
  var app = express()

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

