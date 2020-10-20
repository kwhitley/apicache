var express = require('express')
var compression = require('compression')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options, toggle) {
  var apicache = require('../../dist/main/apicache').newInstance(options)
  var app = express()

  // ENABLE COMPRESSION
  app.use(compression({ threshold: 1 }))

  // EMBED UPSTREAM RESPONSE PARAM
  app.use(function (req, res, next) {
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
  create: function (expiration, config, toggle) {
    return new MockAPI(expiration, config, toggle)
  },
}
