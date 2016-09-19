A simple API/JSON response caching middleware for Express/Node using plain-english durations.
=======

[![Build Status via Travis CI](https://travis-ci.org/kwhitley/apicache.svg)](https://travis-ci.org/kwhitley/apicache)

## Why?

Because caching of simple data/responses should ALSO be simple.

This day and age, with less and less heavy lifting done on the server,
the most common thing we find ourselves doing is
letting the server power the API.  Whether the data is stored in Mongo, SQL,
CouchDB, or whatever - you get a request, you fetch the data, and you return
the data.  Sometimes these fetches are costly and you want to cache the response
so the next hit doesn't hammer your server.  This is why caching exists.

The problem is, with so many cache options, people are still left to fend for themselves
when it comes to implementation.  It often boils down to a manual process similar to the following:

1. Get the request
2. Check your cache for the key/url.
3. If found, intercept and output the cached version.
4. If not, do the work, cache it, and output.

You're still left wrapping the content of each request with this cache-checking mechanism.

Now it can be as simple as telling the request that you want to use a cache, and for
how long results should be cached (*in plain English*, not milliseconds, because
who really wants to calculate that each time?).

## Installation

```
npm install apicache
```

## Usage

To use, simply inject the middleware (example: `apicache('5 minutes')`) into your routes.  Everything else is automagic.

```js
var cache = require('apicache').middleware;

app.get('/api/collection/:id?', cache('5 minutes'), function(req, res) {
  // do some work... this will only occur once per 5 minutes
  res.json({ foo: bar });
});

```

## API

- `apicache.clear([target])` - clears cache target (key or group), or entire cache if no value passed, returns new index.
- `apicache.getIndex()` - returns current cache index [of keys]
- `apicache.middleware([duration])` - the actual middleware that will be used in your routes.  `duration` is in the following format "[length] [unit]", as in `"10 minutes"` or `"1 day"`.
- `apicache.options([options])` - getter/setter for options.  If used as a setter, this function is chainable, allowing you to do things such as... say... return the middleware.

#### Available Options (first value is default)

```js
{
  debug:            false|true,   // if true, enables console output
  defaultDuration:  3600000,      // should be a number (in ms), defaults to 1 hour
  enabled:          true|false,   // if false, turns off caching globally (useful on dev)
  redisClient:      client,       // if provided, uses the [node-redis](https://github.com/NodeRedis/node_redis) client instead of [memory-cache](https://github.com/ptarjan/node-cache)
  appendKey:        [],           // if you want the key (which is the URL) to be appended by something in the req object, put req properties here that point to what you want appended. I.E. req.session.id would be ['session', 'id']
}
```

## Cache Key Groups

Oftentimes it benefits us to group cache entries, for example, by collection (in an API).  This
would enable us to clear all cached "post" requests if we updated something in the "post" collection
for instance. Adding a simple `req.apicacheGroup = [somevalue];` to your route enables this.  See example below:

```js

var apicache  = require('apicache');
var cache     = apicache.middleware;

// GET collection/id
app.get('/api/:collection/:id?', cache('1 hour'), function(req, res, next) {
  req.apicacheGroup = req.params.collection;
  // do some work
  res.send({ foo: 'bar' });
});

// POST collection/id
app.post('/api/:collection/:id?', function(req, res, next) {
  // update model
  apicache.clear(req.params.collection);
  res.send(200);
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

As of v0.2.0, apicache now takes advantage of the brilliant [debug](https://www.npmjs.com/package/debug) module for console logging.  To 
enable, simply add 'apicache' to the DEBUG environment variable

```
export DEBUG=apicache
```

Alternatively, the older method of passing enabling via the .options() function still works.

```js 
var cache = require('apicache').options({ debug: true }).middleware;
```

## Client-Side Bypass

When sharing `GET` routes between admin and public sites, you'll likely want the
routes to be cached from your public client, but NOT cached when from the admin client. This
is achieved by sending a `"x-apicache-bypass": true` header along with the requst from the admin.
The presence of this header flag will bypass the cache, ensuring you aren't looking at stale data.

## Limitations

- `apicache` is currently an in-memory cache, built upon [memory-cache](https://github.com/ptarjan/node-cache).  It may later be expanded to allow other cache-layers.
- This should only be used for JSON responses (as from an API) - if for no other reason, because it will return the cached response as `application/json`.  There's a reason it's called `apicache`.

## Contributors

Special thanks to all those that use this library and report issues, but especially to the following active users that have helped add to the core functionality!

- @rutgernation - JSONP support
- @Amhri - bugfix headers (with redis)
- @enricsangra - added x-apicache-force-fetch header
- @tskillian - custom appendKey path support
- @agolden - Content-Encoding preservation (for gzip, etc)
- @davidyang - express 4+ compatibility
- @gesposito - README update
- @Webcascade - bugfix in cache groups (during debug)
- @nmors - redis support
- @maytis, @ashwinnaidu - redis expiration


