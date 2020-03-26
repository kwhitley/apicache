function RedisCache(options) {
  if (!options.redisClient) return null

  this.redis = options.redisClient
  this.prefix = options.redisPrefix || ''
  this.timers = {}
}

RedisCache.prototype.add = function(key, value, time, timeoutCallback, group) {
  return new Promise(function(resolve, reject) {
    var expire = time + Date.now()
    var multi = redis
      .multi()
      .set(key, JSON.stringify(value))
      .expireAt(key, expire)
    if (group) multi.sadd('group:' + group, key)

    multi.exec(function(err, res) {
      if (err || res === null) return reject(err)

      if (timeoutCallback && typeof timeoutCallback === 'function') {
        this.timers[key] = setTimeout(function() {
          timeoutCallback(value, key)
        }, time)
      }
      resolve({
        value: value,
        expire: expire,
        timeout: this.timers[key]
      })
    })
  })
}

RedisCache.prototype.clear = function(target) {
  return new Promise(function(resolve, reject) {
    if (!target) resolve(this._clearAll())

    var group = 'group:' + target
    this.redis.smembers(group, function(err, keys) {
      if (err) return reject(err)

      keys = this._removePrefix(keys)
      if (keys.length > 0) {
        this.redis.del(group, keys, function(err, deleteCount) {
          if (err) reject(err)
          else {
            keys.forEach(function(key) { clearTimeout(this.timers[key]) })
            resolve(parseInt(deleteCount, 10))
          }
        })
      } else {
        this.redis.del(target, function(err, deleteCount) {
          if (err) reject(err)
          else {
            clearTimeout(this.timers[target])
            resolve(parseInt(deleteCount, 10))
          }
        })
      }
    })
  })
}

RedisCache.prototype.get = function(key) {
  return new Promise(function(resolve, reject) {
    this.redis.get(key, function(err, value) {
      if (err) return reject(err)

      this.redis.pttl(key, function(err, time) {
        resolve({
          value: value,
          expire: time + Date.now(),
          timeout: this.timers[key] || null // available if at same node process
        })
      })
      resolve(value)
    })
  })
}

RedisCache.prototype.geValue = function(key) {
  return new Promise(function(resolve, reject) {
    this.redis.get(key, function(err, value) {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

RedisCache.prototype.getIndex = function(group) {
  return new Promise(function(resolve, reject) {
    if (group) {
      return this.redis.smembers('group:' + group, function(err, keys) {
        if (err) reject(err)
        else resolve (this._removePrefix(keys))
      })
    } else {
      var allKeys = []
      var cursor = 0
      var match = this.prefix && this.prefix + '*'

      function getAll(scanArgs) {
        var keys

        this
          ._scan(scanArgs)
          .then(function(cursorAndKeys) {
            var cursor = cursorAndKeys[0]
            var keys = cursorAndKeys[1]

            keys = this._removePrefix(keys)
            keys.forEach(function(k) { allKeys.push(k) })

            if (cursor === '0') resolve(allKeys)
            else resolve(getAll(cursor, match))
          })
          .catch(reject)
      }

      getAll(cursor, match)
    }
  })
}

RedisCache.prototype._scan = function(cursor, match, count) {
  if (cursor) cursor = 0
  if (count) count = 10

  return new Promise(function(resolve, reject) {
    var args = [
      cursor,
      match && 'MATCH',
      match && match,
      'COUNT',
      count
    ].filter(Boolean)
    this.redis.scan(args, function(err, cursorAndKeys) {
      if (err) return reject(err)

      resolve(cursorAndKeys)
    })
  })
}

RedisCache.prototype._clearAll = function() {
  return new Promise(function(resolve, reject) {
    if (!this.prefix) {
      this.redis.dbsize(function(err, count) {
        if (err) return reject(err)

        this.redis.flushdb(function () {
          Object.keys(this.timers).forEach(function(key) { clearTimeout(this.timers[key]) })
          resolve(parseInt(count, 10))
        })
      })
    } else {
      var deleteCount = 0
      var cursor = 0
      var match = this.prefix + '*'

      function deleteAll(scanArgs) {
        var keys

        this
          ._scan(scanArgs)
          .then(function(cursorAndKeys) {
            var cursor = cursorAndKeys[0]
            var keys = cursorAndKeys[1]

            if (keys.length === 0) {
              if (cursor === '0') return resolve(deleteCount)
              return resolve(deleteAll(cursor, match))
            }

            keys = this._removePrefix(keys)
            this.redis.del(keys, function(err, removedCount) {
              if (err) return reject(err)
              deleteCount += parseInt(removedCount, 10)

              keys.forEach(function(key) { clearTimeout(this.timers[key]) })
              if (cursor === '0') return resolve(deleteCount)
              resolve(deleteAll(cursor, match))
            })
          })
          .catch(reject)
      }

      return deleteAll(cursor, match)
    }
  })
}

RedisCache.prototype._removePrefix = (function() {
  function isArray(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]'
  }
  function removePrefix(str, prefix) {
    var hasPrefix = str.indexOf(prefix) === 0
    return hasPrefix
      ? str.slice(prefix.length)
      : str
  }

  return function(keys) {
    if (!this.prefix) return keys
    if (isArray(keys)) return keys.map(function(key) { return removePrefix(key, this.prefix) })
    else removePrefix(key, this.prefix)
  }
})()

module.exports = RedisCache
