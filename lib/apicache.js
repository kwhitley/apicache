var memCache    = require('memory-cache');
var inflection  = require('inflection');
var url         = require('url');
var _           = require('lodash');

var t           = {
  seconds:      1000,
  minutes:      60000,
  hours:        3600000,
  days:         3600000 * 24,
  weeks:        3600000 * 24 * 7,
  months:       3600000 * 24 * 30,
  years:        3600000 * 24 * 365,
};

function ApiCache() {
  var globalOptions = {
    debug:              false,
    defaultDuration:    3600000,
    enabled:            true,
    appendKey:          [],
    jsonp:              false,
    redisClient:        false
  };

  var index = null;

  this.clear = function(target) {
    var group = index.groups[target];

    if (group) {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing group: ', target);
      }

      _.each(group, function(key) {
        if (globalOptions.debug) {
          console.log('[api-cache]: clearing key: ', key);
        }
        if (!globalOptions.redisClient) {
          memCache.del(key);
        } else {
          globalOptions.redisClient.del(key);
        }
        index.all = _.without(index.all, key);
      });

      delete index.groups[target];
    } else if (target) {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing key: ', target);
      }
      if (!globalOptions.redisClient) {
        memCache.del(target);
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
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing entire index');
      }
      if (!globalOptions.redisClient) {
        memCache.clear();
      } else {
        globalOptions.redisClient.del();
      }
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

    return function cache(req, res, next) {
      var cached;

      if (!globalOptions.enabled || req.headers['x-apicache-bypass'] || (_.isFunction(middlewareToggle) && !middlewareToggle(req, res))) {
        if (globalOptions.debug && req.headers['x-apicache-bypass']) {
          console.log('[api-cache]: bypass detected, skipping cache.');
        }
        return next();
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
        key += '/appendKey=' + appendKey;
      }

      if (!globalOptions.redisClient) {
        cached = memCache.get(key);
      }

      if (cached || globalOptions.redisClient) {

        if (!globalOptions.redisClient) {

          if (globalOptions.debug) {
            console.log('[api-cache]: returning memCached version of "' + key + '"');
          }

          res.statusCode = cached.status;
          res.set(cached.headers);

          if(globalOptions.jsonp) {
            return res.jsonp(cached.body);
          }
          return res.send(cached.body);

        } else {

          if (globalOptions.debug) {
            console.log('[api-cache]: returning redis cached version of "' + key + '"');
          }

          globalOptions.redisClient.hgetall(key, function (err, obj) {
            //var redis_duration = obj.duration || globalOptions.defaultDuration;
            if(err){
              if (globalOptions.debug) {
                console.log('[api-cache] [redis-error]: ' + err);
              }
            }
            if(!obj){
              buildCacheObj();
            }else{
              if(obj.responseObj){

                var redis_responseObj = JSON.parse(obj.responseObj);
                res.statusCode = redis_responseObj.status;
                res.set(JSON.stringify(redis_responseObj.headers));
                return res.send(redis_responseObj.body);
              }else{
                buildCacheObj();
              }
            }
          });

        }

      } else {
        buildCacheObj();
      }

      function buildCacheObj() {
        if (globalOptions.debug) {
          console.log('[api-cache]: path "' + key + '" not found in cache');
        }

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
          if (!memCache.get(key) && !req.headers['x-apicache-bypass']) {
            if (req.apicacheGroup) {
              if (globalOptions.debug) {
                console.log('[api-cache]: group detected: ' + req.apicacheGroup);
              }
              index.groups[req.apicacheGroup] = index.groups[req.apicacheGroup] || [];
              index.groups[req.apicacheGroup].push(key);
            }

            index.all.push(key);
            
            if (globalOptions.debug) {
              console.log('[api-cache]: adding cache entry for "' + key + '" @ ' + duration + ' milliseconds');
            }

            _.each(['Cache-Control', 'Expires'], function(h) {
              var header = res.get(h);
              if (!_.isUndefined(header)) {
                responseObj.headers[h] = header;
              }
            });

            if (!globalOptions.redisClient) {
              memCache.put(key, responseObj, duration);
            } else {
              globalOptions.redisClient.hset(key, "responseObj", JSON.stringify(responseObj));
              globalOptions.redisClient.hset(key, "duration", duration);
            }
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
      all:    [],
      groups: {}
    };
  };

  // initialize index
  this.resetIndex();

  return this;
}

module.exports = new ApiCache();
