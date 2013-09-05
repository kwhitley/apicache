apicache
========

Ultra-simplified API/JSON-caching middleware for Express that even a monkey could implement and use.

## Installation

```
npm install apicache
```

## API

- `apicache.middleware([duration])` - the actual middleware that will be used in your routes.  `duration` is in the following format "[length] [unit]", as in `"10 minutes"` or `"1 day"`.
- `apicache.options([options])` - getter/setter for options.  If used as a setter, this function is chainable, allowing you to do things such as... say... return the middleware.

### Usage

To use, simply inject the middleware (example: `apicache('5 minutes')`) into your routes.  Everything else is automagic.

```js
var apicache = require('apicache').middleware;

...

// an example route
app.get('/api/v1/myroute', apicache('5 minutes'), function(req, res, next) {
  res.send({ foo: bar });
});

```
