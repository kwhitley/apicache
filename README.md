A simple API response caching middleware for Express/Node using plain-english durations.  Supports Redis or built-in memory engine.
=======

[![npm version](https://badge.fury.io/js/apicache.svg)](https://badge.fury.io/js/apicache)
[![Build Status via Travis CI](https://travis-ci.org/kwhitley/apicache.svg?branch=master)](https://travis-ci.org/kwhitley/apicache)

## Why?

Because caching of simple data/responses should ALSO be simple, and calculating milliseconds or manually caching entries seems prehistoric.

## Installation

```
npm install apicache
```

## Dependencies

None (unless using Redis)

## Usage

To use, simply inject the middleware (example: `apicache.middleware('5 minutes', [optionalMiddlewareToggle])`) into your routes.  Everything else is automagic.

#### Cache a route
```js
import express from 'express'
import apicache from 'apicache'

let app = express()
let cache = apicache.middleware

app.get('/api/collection/:id?', cache('5 minutes'), (req, res) => {
  // do some work... this will only occur once per 5 minutes
  res.json({ foo: 'bar' })
})
```

#### Cache all routes
```js
let cache = apicache.middleware

app.use(cache('5 minutes'))

app.get('/will-be-cached', (req, res) => {
  res.json({ success: true })
})
```

#### Use with Redis
```js
import express from 'express'
import apicache from 'apicache'
import redis from 'redis'

let app = express()

// if redisClient option is defined, apicache will use redis client
// instead of built-in memory store
let cacheWithRedis = apicache
                      .options({ redisClient: redis.createClient() })
                      .middleware

app.get('/will-be-cached', cacheWithRedis('5 minutes'), (req, res) => {
  res.json({ success: true })
})
```

#### Cache grouping and manual controls
```js
import apicache from 'apicache'
let cache = apicache.middleware

app.use(cache('5 minutes'))

// routes are automatically added to index, but may be further added
// to groups for quick deleting of collections
app.get('/api/:collection/:item?', (req, res) => {
  req.apicacheGroup = req.params.collection
  res.json({ success: true })
})

// add route to display cache index
app.get('/api/cache/index', (req, res) => {
  res.json(apicache.getIndex())
})

// add route to manually clear target/group
app.get('/api/cache/clear/:target?', (req, res) => {
  res.json(apicache.clear(req.params.target))
})

/*

GET /api/foo/bar --> caches entry at /api/foo/bar and adds a group called 'foo' to index
GET /api/cache/index --> displays index
GET /api/cache/clear/foo --> clears all cached entries for 'foo' group/collection

*/
```

#### Use with middleware toggle for fine control
```js
// higher-order function returns false for requests of other status codes (e.g. 403, 404, 500, etc)
const onlyStatus200 = req => req.statusCode === 200

const cacheSuccesses = cache('5 minutes', onlyStatus200)

app.get('/api/missing', cacheSuccesses, (req, res) => {
  res.status(404).json({ results: 'will not be cached' })
})

app.get('/api/found', cacheSuccesses, (req, res) => {
  res.json({ results: 'will be cached' })
})
```

## API

- `apicache.clear([target])` - clears cache target (key or group), or entire cache if no value passed, returns new index.
- `apicache.getIndex()` - returns current cache index [of keys]
- `apicache.middleware([duration], [toggleMiddleware])` - the actual middleware that will be used in your routes.  `duration` is in the following format "[length] [unit]", as in `"10 minutes"` or `"1 day"`.  A second param is a middleware toggle function, accepting request and response params, and must return truthy to enable cache for the request.
- `apicache.options([options])` - getter/setter for options.  If used as a setter, this function is chainable, allowing you to do things such as... say... return the middleware.
- `apicache.newInstance([options])` - used to create a new ApiCache instance (by default, simply requiring this library shares a common instance)
- `apicache.clone()` - used to create a new ApiCache instance with the same options as the current one

#### Available Options (first value is default)

```js
{
  debug:            false|true,   // if true, enables console output
  defaultDuration:  3600000,      // should be a number (in ms), defaults to 1 hour
  enabled:          true|false,   // if false, turns off caching globally (useful on dev)
  redisClient:      client,       // if provided, uses the [node-redis](https://github.com/NodeRedis/node_redis) client instead of [memory-cache](https://github.com/ptarjan/node-cache)
  appendKey:        [],           // if you want the key (which is the URL) to be appended by something in the req object, put req properties here that point to what you want appended. I.E. req.session.id would be ['session', 'id']
  statusCodes: {
    exclude:        [],           // list status codes to specifically exclude (e.g. [404, 403] cache all responses unless they had a 404 or 403 status)
    include:        [],           // list status codes to require (e.g. [200] caches ONLY responses with a success/200 code)
  }
}
```

## Cache Key Groups

Oftentimes it benefits us to group cache entries, for example, by collection (in an API).  This
would enable us to clear all cached "post" requests if we updated something in the "post" collection
for instance. Adding a simple `req.apicacheGroup = [somevalue];` to your route enables this.  See example below:

```js

var apicache  = require('apicache')
var cache     = apicache.middleware

// GET collection/id
app.get('/api/:collection/:id?', cache('1 hour'), function(req, res, next) {
  req.apicacheGroup = req.params.collection
  // do some work
  res.send({ foo: 'bar' })
});

// POST collection/id
app.post('/api/:collection/:id?', function(req, res, next) {
  // update model
  apicache.clear(req.params.collection)
  res.send('added a new item, so the cache has been cleared')
});

```

Additionally, you could add manual cache control to the previous project with routes such as these:

```js

// GET apicache index (for the curious)
app.get('/api/cache/index', function(req, res, next) {
  res.send(apicache.getIndex());
});

// GET apicache index (for the curious)
app.get('/api/cache/clear/:key?', function(req, res, next) {
  res.send(200, ApiCache.clear(req.params.key || req.query.key));
});
```

## Debugging/Console Out

#### Using Node environment variables (plays nicely with the hugely popular [debug](https://www.npmjs.com/package/debug) module)
```
$ export DEBUG=apicache
$ export DEBUG=apicache,othermoduleThatDebugModuleWillPickUp,etc
```

#### By setting internal option
```js
import apicache from 'apicache'

apicache.options({ debug: true })
```

## Client-Side Bypass

When sharing `GET` routes between admin and public sites, you'll likely want the
routes to be cached from your public client, but NOT cached when from the admin client. This
is achieved by sending a `"x-apicache-bypass": true` header along with the requst from the admin.
The presence of this header flag will bypass the cache, ensuring you aren't looking at stale data.

## Contributors

Special thanks to all those that use this library and report issues, but especially to the following active users that have helped add to the core functionality!

- [@rutgernation](https://github.com/rutgernation) - JSONP support
- [@enricsangra](https://github.com/enricsangra) - added x-apicache-force-fetch header
- [@tskillian](https://github.com/tskillian) - custom appendKey path support
- [@agolden](https://github.com/agolden) - Content-Encoding preservation (for gzip, etc)
- [@davidyang](https://github.com/davidyang) - express 4+ compatibility
- [@gesposito](https://github.com/gesposito) - README update
- [@nmors](https://github.com/nmors) - redis support
- [@maytis](https://github.com/maytis), [@ashwinnaidu](https://github.com/ashwinnaidu) - redis expiration
- [@killdash9](https://github.com/killdash9) - restify support and response accumulator method
- [@svozza](https://github.com/svozza) - added restify tests, test suite refactor, and fixed header issue with restify.  Double thanks!!!
- [@ubergesundheit](https://github.com/ubergesundheit) - Corrected buffer accumulation using res.write with Buffers
- [@danielsogl](https://github.com/danielsogl) - Keeping dev deps up to date

### Bugfixes

- @Amhri, @Webcascade, @conmarap, @cjfurelid, @scambier, @lukechilds, @Red-Lv

### Changelog
- **v0.4.0** - dropped lodash and memory-cache external dependencies, and bumped node version requirements to 4.0.0+ to allow Object.assign native support
- **v0.5.0** - updated internals to use res.end instead of res.send/res.json/res.jsonp, allowing for any response type, adds redis tests
- **v0.6.0** - removed final dependency (debug) and updated README
- **v0.7.0** - internally sets cache-control/max-age headers of response object
- **v0.8.0** - modifies response accumulation (thanks @killdash9) to support res.write + res.end accumulation, allowing integration with restify.  Adds gzip support (Node v4.3.2+ now required) and tests.
- **v0.8.1** - fixed restify support and added appropriate tests (thanks @svozza)
- **v0.8.2** - test suite and mock API refactor (thanks @svozza)
- **v0.8.3** - added tests for x-apicache-bypass and x-apicache-force-fetch (legacy) and fixed a bug in the latter (thanks @Red-Lv)
- **v0.8.4** - corrected buffer accumulation, with test support (thanks @ubergesundheit)
- **v0.8.5** - dev dependencies update (thanks @danielsogl)
- **v0.8.6** - README update

