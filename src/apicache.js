var message     = require('debug')('apicache');
var url         = require('url');
var MemoryCache = require('./memory-cache');
var pkg         = require('../package.json');

var t           = {
  ms:           1,
  second:       1000,
  minute:       60000,
  hour:         3600000,
  day:          3600000 * 24,
  week:         3600000 * 24 * 7,
  month:        3600000 * 24 * 30,
};

var instances = [];

var matches = function(a) {
  return function(b) { return a === b }
}

var doesntMatch = function(a) {
  return function(b) { return !matches(a)(b) }
}

function ApiCache() {
  var memCache = new MemoryCache;

  var globalOptions = {
    debug:              false,
    defaultDuration:    3600000,
    enabled:            true,
    appendKey:          [],
    jsonp:              false,
    redisClient:        false,
    statusCodes: {
      include: [],
      exclude: [],
    }
  };

  var instance = this;
  var index = null;

  instances.push(this);
  this.id = instances.length;

  function debug(msg, msg2) {
    return globalOptions.debug ? console.log('[apicache]: ', msg, msg2) : message(msg, msg2)
  }

  function shouldCacheResponse(response) {
    var opt = globalOptions
    var codes = opt.statusCodes

    if (!response) return false

    if (codes.exclude && codes.exclude.length && codes.exclude.indexOf(response.statusCode) !== -1) return false
    if (codes.include && codes.include.length && codes.include.indexOf(response.statusCode) === -1) return false

    return true
  }

  function addIndexEntries(key, req) {
    var groupName = req.apicacheGroup

    if (groupName) {
      debug('group detected "' + groupName + '"');
      var group = (index.groups[groupName] = index.groups[groupName] || [])
      group.unshift(key);
    }

    index.all.unshift(key);
  }

  function createCacheObject(status, headers, data, encoding) {
    headers['apicache-store'] = globalOptions.redisClient ? 'redis' : 'memory';
    headers['apicache-version'] = pkg.version;
    return {
      status, headers, data, encoding
    }
  }

  function cacheResponse(key, value, duration) {
    var redis = globalOptions.redisClient
    if (redis) {
      debug('storing cached entry in redis', JSON.stringify(value))
      redis.hset(key, "response", JSON.stringify(value));
      redis.hset(key, "duration", duration);
      redis.expire(key, duration/1000);
    } else {
      memCache.add(key, value, duration)
    }

    // add automatic cache clearing from duration, includes max limit on setTimeout
    setTimeout(function() { instance.clear(key) }, Math.min(duration, 2147483647));
  }

  function makeResponseCacheable(req, res, next, key, duration, strDuration) {
    // cache miss, so build and cache (if necessary)
    debug('path "' + key + '" not found in cache');

    // monkeypatch res.end to create cache object
    res.__end = res.end
    res.end = function(content, encoding) {
      if (shouldCacheResponse(res)) {
        debug('adding cache entry for "' + key + '" @ ' + strDuration);
        addIndexEntries(key, req)
        var cacheObject = createCacheObject(res.statusCode, res._headers, content, encoding)
        cacheResponse(key, cacheObject, duration)
      }

      return res.__end(content, encoding)
    }

    next();
  }


  function sendCachedResponse(response, cacheObject) {
    Object.assign(response._headers, cacheObject.headers)

    // unstringify buffers
    var data = cacheObject.data
    if (data.type === 'Buffer') {
      data = new Buffer(data.data)
    }

    response.writeHead(cacheObject.status || 200, response._headers)

    return response.end(data, cacheObject.encoding)
  }

  this.clear = function(target) {
    debug('cache.clear called with target', target)

    var group = index.groups[target];

    if (group) {
      debug('clearing group "' + target + '"');

      group.forEach(function(key) {
        debug('clearing cached entry for "' + key + '"');

        if (!globalOptions.redisClient) {
          memCache.delete(key);
        } else {
          globalOptions.redisClient.del(key);
        }
        index.all = index.all.filter(doesntMatch(key));
      });

      delete index.groups[target];
    } else if (target) {
      debug('clearing cached entry for "' + target + '"');

      if (!globalOptions.redisClient) {
        memCache.delete(target);
      } else {
        globalOptions.redisClient.del(target);
      }

      index.all = index.all.filter(doesntMatch(target))

      Object.keys(index.groups).forEach(function(groupName) {
        var group = index.groups[groupName]

        index.groups[groupName] = index.groups[groupName].filter(doesntMatch(group));
        if (!index.groups[groupName].length) {
          delete index.groups[groupName];
        }
      });
    } else {
      debug('clearing entire index');

      if (!globalOptions.redisClient) {
        memCache.clear();
      } else {
        globalOptions.redisClient.flushdb();
      }
      this.resetIndex();
    }

    return this.getIndex();
  };

  this.getDuration = function(duration) {
    if (typeof duration === 'number') return duration;

    if (typeof duration === 'string') {
      var split = duration.match(/^([\d\.,]+)\s(\w+)$/);

      if (split.length === 3) {
        var len = parseFloat(split[1]);
        var unit = split[2].replace(/s$/i,'').toLowerCase();
        if (unit === 'm') {
          unit = 'ms'
        }

        return (len || 1) * (t[unit] || 0);
      }
    }

    return globalOptions.defaultDuration;
  };

  this.getIndex = function(group) {
    if (group) {
      return index.groups[group];
    } else {
      return index;
    }
  };

  this.middleware = function cache(strDuration, middlewareToggle) {
    var duration = instance.getDuration(strDuration);

    return function cache(req, res, next) {
      function bypass() {
        debug('bypass detected, skipping cache.');
        return next();
      }

      // initial bypass chances
      if (!globalOptions.enabled) return bypass();
      if (req.headers['x-apicache-bypass']) return bypass();
      if (typeof middlewareToggle === 'function') {
        if (!middlewareToggle(req, res)) return bypass();
      } else if (middlewareToggle !== undefined && !middlewareToggle) {
        return bypass();
      }

      // In Express 4.x the url is ambigious based on where a router is mounted.  originalUrl will give the full Url
      var key = req.originalUrl || req.url;

      // Remove querystring from key if jsonp option is enabled
      if (globalOptions.jsonp) {
        key = url.parse(key).pathname;
      }

      if (globalOptions.appendKey.length > 0) {
        var appendKey = req;

        for (var i = 0; i < globalOptions.appendKey.length; i++) {
          appendKey = appendKey[globalOptions.appendKey[i]];
        }
        key += '$$appendKey=' + appendKey;
      }

      // if not forced bypass of cache from client request, attempt cache hit
      if (!req.headers['x-apicache-force-fetch']) {
        // attempt cache hit
        var redis = globalOptions.redisClient
        var cached = !redis ? memCache.getValue(key) : null

        // send if cache hit from memory-cache
        if (cached) {
          return sendCachedResponse(res, cached)
        }

        // send if cache hit from redis
        if (redis) {
          redis.hgetall(key, function (err, obj) {
            if (!err && obj) {
              return sendCachedResponse(res, JSON.parse(obj.response))
            } else {
              return makeResponseCacheable(req, res, next, key, duration, strDuration)
            }
          })
        } else {
          makeResponseCacheable(req, res, next, key, duration, strDuration)
        }
      }
    };
  };

  this.options = function(options) {
    if (options) {
      Object.assign(globalOptions, options);

      return this;
    } else {
      return globalOptions;
    }
  };

  this.resetIndex = function() {
    index = {
      all: [],
      groups: {}
    };
  };

  this.newInstance = function(config) {
    var instance = new ApiCache();

    if (config) {
      instance.options(config)
    }

    return instance
  }

  this.clone = function() {
    return this.newInstance(this.options())
  }

  // initialize index
  this.resetIndex();
}

module.exports = new ApiCache();
