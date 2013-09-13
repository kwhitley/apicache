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

  this.options = function(options) {
    if (options) {
      _.extend(globalOptions, options);

      return this;
    } else {
      return globalOptions;
    }
  };

  this.middleware = function cache(duration) {
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

      if (!globalOptions.enabled || req.headers['x-apicache-bypass']) {
        if (globalOptions.debug && req.headers['x-apicache-bypass']) {
          console.log('[api-cache]: header "x-apicache-bypass" detected, skipping cache.');
        }
        return next();
      }

      if (cached = memCache.get(req.url)) {
        if (globalOptions.debug) {
          console.log('[api-cache]: returning cached version of "' + req.url + '"');
        }
        res.set('Content-Type', 'application/json');
        return res.send(cached);
      } else {
        if (globalOptions.debug) {
          console.log('[api-cache]: path "' + req.url + '" not found in cache');
        }
        res.realSend = res.send;
        res.send = function(statusOrBody, body) {
          // last bypass attempt
          if (!memCache.get(req.url)) {
            if (globalOptions.debug) {
              console.log('[api-cache]: adding cache entry for "' + req.url + '" @ ' + duration + ' milliseconds');
            }
            memCache.put(req.url, body || statusOrBody, duration);
          }

          return res.realSend(body || statusOrBody);
        };
        next();
      }
    };
  };

  return this;
}

module.exports = new ApiCache();
