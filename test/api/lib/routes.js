var movies = require('./data.json')

module.exports = function(app) {
  app.requestsProcessed = 0

  app.get('/api/movies', function(req, res) {
    app.requestsProcessed++

    res.json(movies)
  })

  app.get('/api/params/:where', function(req, res) {
    app.requestsProcessed++

    res.json(movies)
  })


  app.get('/api/writeandend', function(req, res) {
    app.requestsProcessed++

    res.header('Content-Type', 'text/plain')
    res.write('a')
    res.write('b')
    res.write('c')

    res.end()
  })

  app.get('/api/writebufferandend', function(req, res) {
    app.requestsProcessed++


    res.header('Content-Type', 'text/plain')
    if (process.versions.node.indexOf('4') === 0) {
      res.write(new Buffer([0x61]))
      res.write(new Buffer([0x62]))
      res.write(new Buffer([0x63]))
    } else {
      res.write(Buffer.from('a'))
      res.write(Buffer.from('b'))
      res.write(Buffer.from('c'))
    }

    res.end()
  })

  app.get('/api/testheaderblacklist', function(req, res) {
    app.requestsProcessed++
    res.set('x-blacklisted', app.requestsProcessed)
    res.set('x-notblacklisted', app.requestsProcessed)

    res.json(movies)
  })

  app.get('/api/testcachegroup', function(req, res) {
    app.requestsProcessed++
    req.apicacheGroup = 'cachegroup'

    res.json(movies)
  })

  app.get('/api/text', function(req, res) {
    app.requestsProcessed++
    res.header('Content-Type', 'text/plain')

    res.send('plaintext')
  })

  app.get('/api/html', function(req, res) {
    app.requestsProcessed++
    res.header('Content-Type', 'text/html')

    res.send('<html>')
  })

  app.get('/api/missing', function(req, res) {
    app.requestsProcessed++

    res.status(404)
    res.json({ success: false, message: 'Resource not found' })
  })

  app.get('/api/movies/:index', function(req, res) {
    app.requestsProcessed++

    res.json(movies[index])
  })

  return app
}
