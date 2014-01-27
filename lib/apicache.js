var memCache    = require('memory-cache');
var inflection  = require('inflection');
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
    debug:            false,
    defaultDuration:  3600000,
    enabled:          true,
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
        memCache.del(key);
        index.all = _.without(index.all, key);
      });

      delete index.groups[target];
    } else if (target) {
      if (globalOptions.debug) {
        console.log('[api-cache]: clearing key: ', target);
      }
      memCache.del(target);
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
      memCache.clear();
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

      if (cached = memCache.get(req.url)) {
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
          if (!memCache.get(req.url) && !req.headers['x-apicache-bypass']) {
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

            memCache.put(req.url, responseObj, duration);
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
