var memCache    = require('memory-cache');
var inflection  = require('inflection');
var _           = require('lodash');
var redis       = require('redis');
var client      = redis.createClient();

var t           = {
  seconds:      1000,
  minutes:      60000,
  hours:        3600000,
  days:         3600000 * 24,
  weeks:        3600000 * 24 * 7,
  months:       3600000 * 24 * 30,
  years:        3600000 * 24 * 365,
};

function cacheDriver(cacheType) {
  var driver = cacheType;

  this.get = function(key, callback) {
    if(driver === 'memcache') {
      var reply = memCache.get(key);
      return callback.call(reply);
    }

    client.get(key, function(err, reply) {
      return callback.call(JSON.parse(reply));
    });
  };

  this.set = function(key, response, duration) {
    if(driver === 'memcache') {
      memCache.put(key, response, duration);
      return true;
    }

    return client.setex(key, Math.round(duration / 1000), JSON.stringify(response));
  };

  this.del = function(key) {
    if(driver === 'memcache') {
      memCache.del(key);
      return true;
    }

    client.del(key);
    return true;
  };

  this.clearAll = function() {
    if(driver === 'memcache') {
      memCache.clear();
      return true;
    }

    client.keys('*');
    return true;
  };

  return this;
}

function ApiCache() {
  var globalOptions = {
    debug:            false,
    defaultDuration:  3600000,
    enabled:          true,
    driver:           "memcache"
  };

  var index = null;

  this.clear = function(target) {
    var group = index.groups[target];
    var cacheDriver = new cacheDriver(globalOptions.driver);

    if (group) {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing group: ', target);
      }

      _.each(group, function(key) {
        if (globalOptions.debug) {
          console.log('[api-cache]: clearing key: ', key);
        }
        cacheDriver.del(key);
        index.all = _.without(index.all, key);
      });

      delete index.groups[target];
    } else if (target) {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing key: ', target);
      }
      cacheDriver.del(target);
      index.all = _.without(index.all, target);
      _.each(index.groups, function(group, groupName) {
        index.groups[groupName] = _.without(group, target);
        if (!index.groups[groupName].length) {
          delete index.groups[groupName];
        }
      });
    } else {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing entire index');
      }
      cacheDriver.clearAll();
      this.resetIndex();
    }

    return this.getIndex();
  };

  this.getIndex = function(group) {
    if (group) {
      return index.groups[group];
    } else {
      return index;
    }
  };

  this.middleware = function cache(duration, middlewareToggle) {
    if (typeof duration === 'string') {
      var split = duration.match(/^(\d+)\s(\w+)$/);

      if (split.length === 3) {
        var len = split[1];
        var unit = inflection.pluralize(split[2]);

        duration = (len || 1) * (t[unit] || 0);
      }
    }

    if (typeof duration !== 'number' || duration === 0) {
      duration = globalOptions.defaultDuration ;
    }

  this.middleware = function cache(duration, middlewareToggle) {
    var cacheDriver = new cacheDriver(globalOptions.driver);

    if (typeof duration === 'string') {
      var split = duration.match(/^(\d+)\s(\w+)$/);

      if (split.length === 3) {
        var len = split[1];
        var unit = inflection.pluralize(split[2]);

        duration = (len || 1) * (t[unit] || 0);
      }
    }

    if (typeof duration !== 'number' || duration === 0) {
      duration = globalOptions.defaultDuration ;
    }
    return function cache(req, res, next) {

      var cached;

      if (!globalOptions.enabled || req.headers['x-apicache-bypass'] || (_.isFunction(middlewareToggle) && !middlewareToggle(req, res))) {
        if (globalOptions.debug && req.headers['x-apicache-bypass']) {
          console.log('[api-cache]: bypass detected, skipping cache.');
        }
        return next();
      }

      cacheDriver.get(req.url, function(reply) {

        if (cached = reply) {
          if (globalOptions.debug) {
            console.log('[api-cache]: returning cached version of "' + req.url + '"');
          }

          res.statusCode = cached.status;
          res.set(cached.headers);

          return res.send(cached.body);
        } else {

          if (globalOptions.debug) {
            console.log('[api-cache]: path "' + req.url + '" not found in cache');
          }

          res.realSend = res.send;

          res.send = function(a, b) {
            var responseObj = {
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              }
            };

            responseObj.status  = !_.isUndefined(b) ? a : (_.isNumber(a) ? a : res.statusCode);
            responseObj.body    = !_.isUndefined(b) ? b : (!_.isNumber(a) ? a : null);

            // last bypass attempt
            if (!cached && !req.headers['x-apicache-bypass']) {
              if (globalOptions.debug) {
                if (req.apicacheGroup) {
                  console.log('[api-cache]: group detected: ' + req.apicacheGroup);
                  index.groups[req.apicacheGroup] = index.groups[req.apicacheGroup] || [];
                  index.groups[req.apicacheGroup].push(req.url);
                }

                index.all.push(req.url);
                console.log('[api-cache]: adding cache entry for "' + req.url + '" @ ' + duration + ' milliseconds');
              }

              _.each(['Cache-Control', 'Expires'], function(h) {
                var header = res.get(h);
                if (!_.isUndefined(header)) {
                  responseObj.headers[h] = header;
                }
              });
              cacheDriver.set(req.url, responseObj, duration);
            }

            return res.realSend(responseObj.body);
          };
          next();
        }
      });

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
      all:    [],
      groups: {}
    };
  };

  // initialize index
  this.resetIndex();

  return this;
}

module.exports = new ApiCache();
