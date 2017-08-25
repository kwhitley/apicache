function MemoryCache() {
  this.cache = new Map()
}

MemoryCache.prototype.add = function(key, value, time, timeoutCallback) {
  var instance = this

  var entry = {
    value: value,
    expire: time + Date.now(),
    timeout: setTimeout(function() {
      instance.delete(key)
      return timeoutCallback && typeof timeoutCallback === 'function' && timeoutCallback(value, key)
    }, time)
  }

  this.cache.set(key, entry)

  return entry
}

MemoryCache.prototype.delete = function(key) {
  var entry = this.cache.get(key)

  if (entry) {
    clearTimeout(entry.timeout)
  }

  this.cache.delete(key)

  return this
}

MemoryCache.prototype.get = function(key) {
  return this.cache.get(key)
}

MemoryCache.prototype.getValue = function(key) {
  var entry = this.get(key)

  return entry && entry.value
}

MemoryCache.prototype.clear = function() {
  this.cache.forEach(key => this.delete(key))

  return this
}

module.exports = MemoryCache
