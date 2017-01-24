var restify = require('restify')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options) {
  var apicache = require('../../src/apicache').newInstance(options)
  var app = restify.createServer()

  // ENABLE APICACHE
  app.use(apicache.middleware(expiration))
  app.apicache = apicache

  app.use(function(req, res, next) {
    res.charSet('utf-8');
    next()
  })

  app.use(require('restify-etag-cache')())

  // ADD API ROUTES
  app = addRoutes(app)

  return app
}

module.exports = {
  create: function(expiration, config) { return new MockAPI(expiration, config) }
}
