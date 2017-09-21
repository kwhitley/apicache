var express = require('express')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options, toggle) {
  var apicache = require('../../src/apicache').newInstance(options)
  var app = express()

  // EMBED UPSTREAM RESPONSE PARAM
  app.use(function(req, res, next) {
    res.id = 123
    next()
  })

  // ENABLE APICACHE
  app.use(apicache.middleware(expiration, toggle))
  app.apicache = apicache

  // ADD API ROUTES
  app = addRoutes(app)

  return app
}

module.exports = {
  create: function(expiration, config, toggle) { return new MockAPI(expiration, config, toggle) }
}

