var stream = require('stream')

function MemoryCache() {
  this.cache = {}
  this.size = 0
}

MemoryCache.prototype.createReadStream = function(key) {
  var chunk = this.getValue(key).data

  return new stream.Readable({
    read() {
      try {
        var shouldPush = this.push(chunk)
        chunk = null
        if (shouldPush) this.push(chunk)
      } catch (err) {
        this.emit('error', err)
      }
    },
  }).on('error', function() {
    this.unpipe()
    // if node < 8
    if (!this.destroy) return this.pause()
    this.destroy()
  })
}

MemoryCache.prototype.add = function(key, value, time, timeoutCallback) {
  var instance = this

  var entry = {
    value: value,
    expire: time + Date.now(),
    timeout: setTimeout(function() {
      instance.delete(key)
      return timeoutCallback && typeof timeoutCallback === 'function' && timeoutCallback(value, key)
    }, time),
  }

  this.cache[key] = entry
  this.size = Object.keys(this.cache).length

  return entry
}

MemoryCache.prototype.delete = function(key) {
  var entry = this.cache[key]

  if (entry) {
    clearTimeout(entry.timeout)
  }

  delete this.cache[key]

  this.size = Object.keys(this.cache).length

  return null
}

MemoryCache.prototype.get = function(key) {
  var entry = this.cache[key]

  return entry
}

MemoryCache.prototype.getValue = function(key) {
  var entry = this.get(key)

  return entry && entry.value
}

MemoryCache.prototype.clear = function() {
  Object.keys(this.cache).forEach(function(key) {
    this.delete(key)
  }, this)

  return true
}

module.exports = MemoryCache
