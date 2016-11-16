var message     = require('debug')('apicache');
var url         = require('url');
var _           = require('lodash');
var MemoryCache = require('./memory-cache');
var pjson       = require('../package.json');

var t           = {
  ms:           1,
  second:       1000,
  minute:       60000,
  hour:         3600000,
  day:          3600000 * 24,
  week:         3600000 * 24 * 7,
  month:        3600000 * 24 * 30,
  year:         3600000 * 24 * 365,
};

var instances = [];

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

    // console.log('shouldCacheResponse', response)
    if (!response) return false

    if (codes.exclude && codes.exclude.length && codes.exclude.indexOf(response.status) !== -1) return false
    if (codes.include && codes.include.length && codes.include.indexOf(response.status) === -1) return false
    // console.log('passed!')

    return true
  }

  this.clear = function(target) {
    var group = index.groups[target];

    if (group) {
      console.log('clearing group', group)
      debug('clearing group "' + target + '"');

      _.each(group, function(key) {
        debug('clearing cached entry for "' + key + '"');

        if (!globalOptions.redisClient) {
          memCache.delete(key);
        } else {
          globalOptions.redisClient.del(key);
        }
        index.all = _.without(index.all, key);
      });

      delete index.groups[target];
    } else if (target) {
      debug('clearing cached entry for "' + target + '"');

      if (!globalOptions.redisClient) {
        memCache.delete(target);
      } else {
        globalOptions.redisClient.del(target);
      }
      index.all = _.without(index.all, target);
      _.each(index.groups, function(group, groupName) {
        index.groups[groupName] = _.without(group, target);
        if (!index.groups[groupName].length) {
          delete index.groups[groupName];
        }
      });
    } else {
      debug('clearing entire index');

      if (!globalOptions.redisClient) {
        memCache.clear();
      } else {
        globalOptions.redisClient.del();
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
      var cached;

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

      if (!globalOptions.redisClient) {
        cached = memCache.get(key);

        cached = cached && cached.value;
      }

      if ((cached || globalOptions.redisClient) && !req.headers['x-apicache-force-fetch']) {

        if (!globalOptions.redisClient) {

          debug('returning memory-cached version of "' + key + '"');

          res.statusCode = cached.status;
          res.set(cached.headers);

          if(globalOptions.jsonp) {
            return res.jsonp(cached.body);
          }
          return res.send(cached.body);

        } else {

          debug('returning redis cached version of "' + key + '"');

          globalOptions.redisClient.hgetall(key, function (err, obj) {
            //var redis_duration = obj.duration || globalOptions.defaultDuration;
            if (err) {
              debug('[api-cache] [redis-error]: ' + err);
            }

            if (!obj) {
              buildCacheObj();
            } else {
              if (obj.responseObj) {
                var redis_responseObj = JSON.parse(obj.responseObj);
                res.statusCode = redis_responseObj.status;
                res.set(redis_responseObj.headers);
                return res.send(redis_responseObj.body);
              } else {
                buildCacheObj();
              }
            }
          });
        }
      } else {
        buildCacheObj();
      }

      function buildCacheObj() {
        debug('path "' + key + '" not found in cache');

        res.realSend = (globalOptions.jsonp) ? res.jsonp : res.send;

        var methodName = (globalOptions.jsonp) ? "jsonp" : "send";

        res[methodName] = function(a, b) {
          var responseObj = {
            headers: {
              'Content-Type': 'application/json; charset=utf-8'
            }
          };

          responseObj.status  = !_.isUndefined(b) ? a : (_.isNumber(a) ? a : res.statusCode);
          responseObj.body    = !_.isUndefined(b) ? b : (!_.isNumber(a) ? a : null);

          // last bypass attempt
          if (shouldCacheResponse(responseObj) && !memCache.get(key) && !req.headers['x-apicache-bypass']) {
            if (req.apicacheGroup) {
              debug('group detected "' + req.apicacheGroup + '"');

              index.groups[req.apicacheGroup] = index.groups[req.apicacheGroup] || [];
              index.groups[req.apicacheGroup].push(key);
            }

            index.all.push(key);

            debug('adding cache entry for "' + key + '" @ ' + strDuration);

            _.each(['Cache-Control', 'Expires', 'Content-Encoding'], function(h) {
              var header = res.get(h);
              if (!_.isUndefined(header)) {
                responseObj.headers[h] = header;
              }
            });

            responseObj.headers['apicache-version'] = pjson.version;

            if (!globalOptions.redisClient) {
              responseObj.headers['apicache-store'] = 'memory';
              memCache.add(key, responseObj, duration);
            } else {
              responseObj.headers['apicache-store'] = 'redis';
              globalOptions.redisClient.hset(key, "responseObj", JSON.stringify(responseObj));
              globalOptions.redisClient.hset(key, "duration", duration);
              globalOptions.redisClient.expire(key, duration/1000);
            }

            setTimeout(function() { instance.clear(key) }, duration);
          }

          return res.realSend(responseObj.body);
        };
        next();
      }
    };
  };

  this.options = function(options) {
    if (options) {
      _.extend(globalOptions, options);

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
