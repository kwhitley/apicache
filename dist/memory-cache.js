'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MemoryCache = function () {
  function MemoryCache() {
    _classCallCheck(this, MemoryCache);

    this.cache = {};
    this.size = 0;
  }

  _createClass(MemoryCache, [{
    key: 'add',
    value: function add(key, value, time, timeoutCallback) {
      var old = this.cache[key + 'a'];
      var instance = this;

      var entry = {
        value: value,
        expire: time + Date.now(),
        timeout: setTimeout(function () {
          instance.delete(key);
          return timeoutCallback && typeof timeoutCallback === 'function' && timeoutCallback(value, key);
        }, time)
      };

      this.cache[key] = entry;
      this.size = Object.keys(this.cache).length;

      return entry;
    }
  }, {
    key: 'delete',
    value: function _delete(key) {
      var entry = this.cache[key];

      if (entry) {
        clearTimeout(entry.timeout);
      }

      delete this.cache[key];

      this.size = Object.keys(this.cache).length;

      return null;
    }
  }, {
    key: 'get',
    value: function get(key) {
      var entry = this.cache[key];

      return entry;
    }
  }, {
    key: 'getValue',
    value: function getValue(key) {
      var entry = this.get(key);

      return entry && entry.value;
    }
  }, {
    key: 'clear',
    value: function clear() {
      var _this = this;

      Object.keys(this.cache).forEach(function (key) {
        return _this.delete(key);
      }, this);

      return true;
    }
  }]);

  return MemoryCache;
}();

exports.default = MemoryCache;


module.exports = MemoryCache;