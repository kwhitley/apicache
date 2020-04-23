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

    res.setHeader('Content-Type', 'text/plain')
    res.write('a')
    res.write('b')
    res.write('c')

    res.end()
  })

  app.get('/api/writebufferandend', function(req, res) {
    app.requestsProcessed++

    res.setHeader('Content-Type', 'text/plain')
    if (process.versions.node.indexOf('4') === 0) {
      /* eslint-disable node/no-deprecated-api */
      res.write(new Buffer([0x61]))
      res.write(new Buffer([0x62]))
      res.write(new Buffer([0x63]))
      /* eslint-enable node/no-deprecated-api */
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
    res.setHeader('Content-Type', 'text/plain')

    res.send('plaintext')
  })

  app.get('/api/html', function(req, res) {
    app.requestsProcessed++
    res.setHeader('Content-Type', 'text/html')

    res.send('<html>')
  })

  app.get('/api/missing', function(req, res) {
    app.requestsProcessed++

    res.status(404)
    res.json({ success: false, message: 'Resource not found' })
  })

  app.get('/api/movies/:index', function(req, res) {
    app.requestsProcessed++

    res.json(movies[req.params.index])
  })

  app.get('/api/bigresponse', function(req, res) {
    app.requestsProcessed++
    req.apicacheGroup = 'bigresponsegroup'

    var chunkCount = 250
    var chunkLength = 16384
    var chunk = new Array(16384).fill('a').join('')
    var rstream = require('stream').Readable({
      highWaterMark: chunkLength,
      read() {
        if (chunkCount-- === 0) this.push(null)
        else this.push(chunk)
      },
    })

    res.writeHead(200, { 'Content-Type': 'text/plain' })
    rstream.pipe(res)
  })

  app.get('/api/slowresponse', function(req, res) {
    app.requestsProcessed++

    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.write('hello ')
    setTimeout(function() {
      res.write('world')
      res.end()
    }, 100)
  })

  return app
}
