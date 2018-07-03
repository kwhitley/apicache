A simple API response caching middleware for Express/Node using plain-english durations.
=======
#### Supports Redis or built-in memory engine with auto-clearing.

[![npm version](https://badge.fury.io/js/apicache.svg)](https://www.npmjs.com/package/apicache)
[![node version support](https://img.shields.io/node/v/apicache.svg)](https://www.npmjs.com/package/apicache)
[![Build Status via Travis CI](https://travis-ci.org/kwhitley/apicache.svg?branch=master)](https://travis-ci.org/kwhitley/apicache)
[![Coverage Status](https://coveralls.io/repos/github/kwhitley/apicache/badge.svg?branch=master)](https://coveralls.io/github/kwhitley/apicache?branch=master)
[![NPM downloads](https://img.shields.io/npm/dt/apicache.svg?style=flat-square)](https://www.npmjs.com/package/apicache)

## Why?
Because route-caching of simple data/responses should ALSO be simple.

## Installation
```bash
$ npm install --save apicache
```

##### *Optional: Typescript Types (courtesy of [@danielsogl](https://github.com/danielsogl))
```bash
$ npm install -D @types/apicache
```

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
// higher-order function returns false for responses of other status codes (e.g. 403, 404, 500, etc)
const onlyStatus200 = (req, res) => res.statusCode === 200

const cacheSuccesses = cache('5 minutes', onlyStatus200)

app.get('/api/missing', cacheSuccesses, (req, res) => {
  res.status(404).json({ results: 'will not be cached' })
})

app.get('/api/found', cacheSuccesses, (req, res) => {
  res.json({ results: 'will be cached' })
})
```

#### Prevent cache-control header "max-age" from automatically being set to expiration age
```js
let cache = apicache.options({
              headers: {
                'cache-control': 'no-cache'
              }
            })
            .middleware

let cache5min = cache('5 min') // continue to use normally
```

## API

- `apicache.options([globalOptions])` - getter/setter for global options.  If used as a setter, this function is chainable, allowing you to do things such as... say... return the middleware.
- `apicache.middleware([duration], [toggleMiddleware], [localOptions])` - the actual middleware that will be used in your routes.  `duration` is in the following format "[length] [unit]", as in `"10 minutes"` or `"1 day"`.  A second param is a middleware toggle function, accepting request and response params, and must return truthy to enable cache for the request. Third param is the options that will override global ones and affect this middleware only.
- `middleware.options([localOptions])` - getter/setter for middleware-specific options that will override global ones.
- `apicache.getIndex()` - returns current cache index [of keys]
- `apicache.clear([target])` - clears cache target (key or group), or entire cache if no value passed, returns new index.
- `apicache.newInstance([options])` - used to create a new ApiCache instance (by default, simply requiring this library shares a common instance)
- `apicache.clone()` - used to create a new ApiCache instance with the same options as the current one

#### Available Options (first value is default)

```js
{
  debug:            false|true,     // if true, enables console output
  defaultDuration:  '1 hour',       // should be either a number (in ms) or a string, defaults to 1 hour
  enabled:          true|false,     // if false, turns off caching globally (useful on dev)
  redisClient:      client,         // if provided, uses the [node-redis](https://github.com/NodeRedis/node_redis) client instead of [memory-cache](https://github.com/ptarjan/node-cache)
  appendKey:        fn(req, res),   // appendKey takes the req/res objects and returns a custom value to extend the cache key
  headerBlacklist:  [],             // list of headers that should never be cached
  statusCodes: {
    exclude:        [],             // list status codes to specifically exclude (e.g. [404, 403] cache all responses unless they had a 404 or 403 status)
    include:        [],             // list status codes to require (e.g. [200] caches ONLY responses with a success/200 code)
  },
  headers: {
    // 'cache-control':  'no-cache' // example of header overwrite
  }
}
```

## Custom Cache Keys

Sometimes you need custom keys (e.g. save routes per-session, or per method).
We've made it easy!

**Note:** All req/res attributes used in the generation of the key must have been set
previously (upstream).  The entire route logic block is skipped on future cache hits
so it can't rely on those params.

```js
apicache.options({
  appendKey: (req, res) => req.method + res.session.id
})
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
  res.send(200, apicache.clear(req.params.key || req.query.key));
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

- [@svozza](https://github.com/svozza) - added restify tests, test suite refactor, and fixed header issue with restify.  Node v7 + Restify v5 conflict resolution, etag/if-none-match support, etcetc, etc.  Triple thanks!!!
- [@andredigenova](https://github.com/andredigenova) - Added header blacklist as options, correction to caching checks
- [@peteboere](https://github.com/peteboere) - Node v7 headers update
- [@rutgernation](https://github.com/rutgernation) - JSONP support
- [@enricsangra](https://github.com/enricsangra) - added x-apicache-force-fetch header
- [@tskillian](https://github.com/tskillian) - custom appendKey path support
- [@agolden](https://github.com/agolden) - Content-Encoding preservation (for gzip, etc)
- [@davidyang](https://github.com/davidyang) - express 4+ compatibility
- [@nmors](https://github.com/nmors) - redis support
- [@maytis](https://github.com/maytis), [@ashwinnaidu](https://github.com/ashwinnaidu) - redis expiration
- [@killdash9](https://github.com/killdash9) - restify support and response accumulator method
- [@ubergesundheit](https://github.com/ubergesundheit) - Corrected buffer accumulation using res.write with Buffers
- [@danielsogl](https://github.com/danielsogl) - Keeping dev deps up to date, Typescript Types
- [@vectart](https://github.com/vectart) - Added middleware local options support
- [@davebaol](https://github.com/davebaol) - Added string support to defaultDuration option (previously just numeric ms)
- [@Rauttis](https://github.com/rauttis) - Added ioredis support

### Bugfixes, Documentation, etc.

- @Amhri, @Webcascade, @conmarap, @cjfurelid, @scambier, @lukechilds, @Red-Lv, @gesposito, @viebel, @RowanMeara, @GoingFast, @luin

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
- **v0.8.6, v0.8.7** - README update
- **v0.8.8** - corrected to use node v7+ headers (thanks @peteboere)
- **v0.9.0** - corrected Node v7.7 & v8 conflicts with restify (huge thanks to @svozza
 for chasing this down and fixing upstream in restify itself).  Added coveralls.  Added
 middleware.localOptions support (thanks @vectart).  Added ability to overwrite/embed headers
 (e.g. "cache-control": "no-cache") through options.
- **v0.9.1** - added eslint in prep for v1.x branch, minor ES6 to ES5 in master branch tests
- **v0.10.0** - added ability to blacklist headers (prevents caching) via options.headersBlacklist (thanks @andredigenova)
- **v0.11.0** - Added string support to defaultDuration option, previously just numeric ms - thanks @davebaol
- **v0.11.1** - correction to status code caching, and max-age headers are no longer sent when not cached.  middlewareToggle now works as intended with example of statusCode checking (checks during shouldCacheResponse cycle)
- **v0.11.2** - dev-deps update, courtesy of @danielsogl
- **v1.0.0** - stamping v0.11.2 into official production version, will now begin developing on branch v2.x (redesign)
- **v1.1.0** - added the much-requested feature of a custom appendKey function (previously only took a path to a single request attribute).  Now takes (request, response) objects and returns some value to be appended to the cache key.
- **v1.1.1** - bugfixes in expiration timeout clearing and content header preservation under compression (thanks @RowanMeara and @samimakicc).
- **v1.2.0** - Supports ioredis (thanks @Rauttis)
- **v1.2.1** - Updated deps
- **v1.2.2** - bugfix: ioredis.expire params (thanks @GoingFast and @luin)
- **v1.2.3** - add etag to if-none-match 304 support (thanks for the test/issue @svozza)
