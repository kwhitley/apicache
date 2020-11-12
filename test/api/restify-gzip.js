var restify = require('restify')
var addRoutes = require('./lib/routes')

function MockAPI(expiration, options, toggle) {
  var apicache = require('../../src/apicache').newInstance(options)
  var app = restify.createServer()

  // EMBED UPSTREAM RESPONSE PARAM
  app.use(function(req, res, next) {
    res.id = 123
    next()
  })

  app.use(function(req, res, next) {
    res.charSet('utf-8')
    next()
  })

  // ENABLE APICACHE
  app.use(apicache.middleware(expiration, toggle))
  app.apicache = apicache

  // ENABLE COMPRESSION
  var whichGzip = (restify.gzipResponse && restify.gzipResponse()) || restify.plugins.gzipResponse()
  app.use(whichGzip)

  app.use(require('restify-etag-cache')())

  // ADD API ROUTES
  app = addRoutes(app)

  return app
}

module.exports = {
  create: function(expiration, config, toggle) {
    return new MockAPI(expiration, config, toggle)
  },
}
