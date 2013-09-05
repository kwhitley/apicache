var memCache    = require('memory-cache');
var inflection  = require('inflection');
var _           = require('lodash');

var t           = {
  seconds:      1000,
  minutes:      60000,
  hours:        3600000,
  days:         3600000 * 24,
  weeks:        3600000 * 24 * 7,
};

function ApiCache() {
  var globalOptions = {
    debug: false
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
      duration = 3600000;
    }

    return function cache(req, res, next) {
      var cached;

      if (cached = memCache.get(req.url)) {
        if (globalOptions.debug) {
          console.log('[api-cache]: returning cached version...');
        }
        res.set('Content-Type', 'application/json');
        return res.send(cached);
      } else {
        if (globalOptions.debug) {
          console.log('[api-cache]: not cached... preparing to cache...');
        }
        res.realSend = res.send;
        res.send = function(body) {
          if (globalOptions.debug) {
            console.log('[api-cache]: adding cache entry for ' + duration + ' milliseconds');
          }
          memCache.put(req.url, body, duration);
          return res.realSend(body);
        };
        next();
      }
    };
  };

  return this;
}

module.exports = new ApiCache();
