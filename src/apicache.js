var url         = require('url')
var MemoryCache = require('./memory-cache')
var pkg         = require('../package.json')

var t           = {
  ms:           1,
  second:       1000,
  minute:       60000,
  hour:         3600000,
  day:          3600000 * 24,
  week:         3600000 * 24 * 7,
  month:        3600000 * 24 * 30,
}

var instances = []

var matches = function(a) {
  return function(b) { return a === b }
}

var doesntMatch = function(a) {
  return function(b) { return !matches(a)(b) }
}

var logDuration = function(d, prefix) {
  var str = (d > 1000) ? ((d/1000).toFixed(2) + 'sec') : (d + 'ms')
  return '\x1b[33m- ' + (prefix ? prefix + ' ' : '') + str + '\x1b[0m'
}

function ApiCache() {
  var memCache = new MemoryCache

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
  }

  var instance = this
  var index = null

  instances.push(this)
  this.id = instances.length

  function debug(a,b,c,d) {
    var arr = (['\x1b[36m[apicache]\x1b[0m', a,b,c,d]).filter(function(arg) { return arg !== undefined })
    var debugEnv = process.env.DEBUG && process.env.DEBUG.split(',').indexOf('apicache') !== -1

    return (globalOptions.debug || debugEnv) && console.log.apply(null, arr)
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
      debug('group detected "' + groupName + '"')
      var group = (index.groups[groupName] = index.groups[groupName] || [])
      group.unshift(key)
    }

    index.all.unshift(key)
  }

  function createCacheObject(status, headers, data, encoding) {
    return {
      status: status,
      headers: Object.assign({}, headers),
      data: data,
      encoding: encoding
    }
  }

  function cacheResponse(key, value, duration) {
    var redis = globalOptions.redisClient
    if (redis) {
      redis.hset(key, "response", JSON.stringify(value))
      redis.hset(key, "duration", duration)
      redis.expire(key, duration/1000)
    } else {
      memCache.add(key, value, duration)
    }

    // add automatic cache clearing from duration, includes max limit on setTimeout
    setTimeout(function() { instance.clear(key, true) }, Math.min(duration, 2147483647))
  }

  function accumulateContent(res, content) {
    if (content) {
      if (typeof(content) == 'string') {
        res._apicache.content = (res._apicache.content || '') + content;
      } else if (Buffer.isBuffer(content)) {
        var oldContent = res._apicache.content
        if (!oldContent) {
          oldContent = !Buffer.alloc ? new Buffer(0) : Buffer.alloc(0);
        }
        res._apicache.content = Buffer.concat([oldContent, content], oldContent.length + content.length);
      } else {
        res._apicache.content = content
        // res._apicache.cacheable = false;
      }
    }
  }

  function makeResponseCacheable(req, res, next, key, duration, strDuration) {
    // monkeypatch res.end to create cache object
    res._apicache = {
      write: res.write,
      end: res.end,
      cacheable: true,
      content: undefined
    }

    // add cache control headers
    res.header('cache-control', 'max-age=' + (duration / 1000).toFixed(0))

    // patch res.write
    res.write = function(content) {
      accumulateContent(res, content);
      return res._apicache.write.apply(this, arguments);
    }

    // patch res.end
    res.end = function(content, encoding) {
      if (shouldCacheResponse(res)) {

        accumulateContent(res, content);

        if (res._apicache.cacheable && res._apicache.content) {
          addIndexEntries(key, req)
          var cacheObject = createCacheObject(res.statusCode, res._headers, res._apicache.content, encoding)
          cacheResponse(key, cacheObject, duration)

          // display log entry
          var elapsed = new Date() - req.apicacheTimer
          debug('adding cache entry for "' + key + '" @ ' + strDuration, logDuration(elapsed))
        }
      }

      return res._apicache.end.apply(this, arguments);
    }

    next()
  }


  function sendCachedResponse(response, cacheObject) {
    response._headers = response._headers || {}
    Object.assign(response._headers, cacheObject.headers || {}, {
      'apicache-store': globalOptions.redisClient ? 'redis' : 'memory',
      'apicache-version': pkg.version
    })

    // unstringify buffers
    var data = cacheObject.data
    if (data && data.type === 'Buffer') {
      data = new Buffer(data.data)
    }

    response.writeHead(cacheObject.status || 200, response._headers)

    return response.end(data, cacheObject.encoding)
  }

  this.clear = function(target, isAutomatic) {
    var group = index.groups[target]
    var redis = globalOptions.redisClient

    if (group) {
      debug('clearing group "' + target + '"')

      group.forEach(function(key) {
        debug('clearing cached entry for "' + key + '"')

        if (!globalOptions.redisClient) {
          memCache.delete(key)
        } else {
          redis.del(key)
        }
        index.all = index.all.filter(doesntMatch(key))
      })

      delete index.groups[target]
    } else if (target) {
      debug('clearing ' + (isAutomatic ? 'expired' : 'cached') + ' entry for "' + target + '"')

      // clear actual cached entry
      if (!redis) {
        memCache.delete(target)
      } else {
        redis.del(target)
      }

      // remove from global index
      index.all = index.all.filter(doesntMatch(target))

      // remove target from each group that it may exist in
      Object.keys(index.groups).forEach(function(groupName) {
        index.groups[groupName] = index.groups[groupName].filter(doesntMatch(target))

        // delete group if now empty
        if (!index.groups[groupName].length) {
          delete index.groups[groupName]
        }
      })
    } else {
      debug('clearing entire index')

      if (!redis) {
        memCache.clear()
      } else {
        // clear redis keys one by one from internal index to prevent clearing non-apicache entries
        index.all.forEach(function(key) {
          redis.del(key)
        })
      }
      this.resetIndex()
    }

    return this.getIndex()
  }

  this.getDuration = function(duration) {
    if (typeof duration === 'number') return duration

    if (typeof duration === 'string') {
      var split = duration.match(/^([\d\.,]+)\s(\w+)$/)

      if (split.length === 3) {
        var len = parseFloat(split[1])
        var unit = split[2].replace(/s$/i,'').toLowerCase()
        if (unit === 'm') {
          unit = 'ms'
        }

        return (len || 1) * (t[unit] || 0)
      }
    }

    return globalOptions.defaultDuration
  }

  this.getIndex = function(group) {
    if (group) {
      return index.groups[group]
    } else {
      return index
    }
  }

  this.middleware = function cache(strDuration, middlewareToggle) {
    var duration = instance.getDuration(strDuration)

    return function cache(req, res, next) {
      function bypass() {
        debug('bypass detected, skipping cache.')
        return next()
      }

      // initial bypass chances
      if (!globalOptions.enabled) return bypass()
      if (req.headers['x-apicache-bypass'] || req.headers['x-apicache-force-fetch']) return bypass()
      if (typeof middlewareToggle === 'function') {
        if (!middlewareToggle(req, res)) return bypass()
      } else if (middlewareToggle !== undefined && !middlewareToggle) {
        return bypass()
      }

      // embed timer
      req.apicacheTimer = new Date()

      // In Express 4.x the url is ambigious based on where a router is mounted.  originalUrl will give the full Url
      var key = req.originalUrl || req.url

      // Remove querystring from key if jsonp option is enabled
      if (globalOptions.jsonp) {
        key = url.parse(key).pathname
      }

      if (globalOptions.appendKey.length > 0) {
        var appendKey = req

        for (var i = 0; i < globalOptions.appendKey.length; i++) {
          appendKey = appendKey[globalOptions.appendKey[i]]
        }
        key += '$$appendKey=' + appendKey
      }

      // attempt cache hit
      var redis = globalOptions.redisClient
      var cached = !redis ? memCache.getValue(key) : null

      // send if cache hit from memory-cache
      if (cached) {
        var elapsed = new Date() - req.apicacheTimer
        debug('sending cached (memory-cache) version of', key, logDuration(elapsed))

        return sendCachedResponse(res, cached)
      }

      // send if cache hit from redis
      if (redis) {
        redis.hgetall(key, function (err, obj) {
          if (!err && obj) {
            var elapsed = new Date() - req.apicacheTimer
            debug('sending cached (redis) version of', key, logDuration(elapsed))

            return sendCachedResponse(res, JSON.parse(obj.response))
          } else {
            return makeResponseCacheable(req, res, next, key, duration, strDuration)
          }
        })
      } else {
        return makeResponseCacheable(req, res, next, key, duration, strDuration)
      }
    }
  }

  this.options = function(options) {
    if (options) {
      Object.assign(globalOptions, options)

      return this
    } else {
      return globalOptions
    }
  }

  this.resetIndex = function() {
    index = {
      all: [],
      groups: {}
    }
  }

  this.newInstance = function(config) {
    var instance = new ApiCache()

    if (config) {
      instance.options(config)
    }

    return instance
  }

  this.clone = function() {
    return this.newInstance(this.options())
  }

  // initialize index
  this.resetIndex()
}

module.exports = new ApiCache()
