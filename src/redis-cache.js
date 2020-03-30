function RedisCache(options, debug) {
  this.redis = options.redisClient
  this.prefix =
    options.redisPrefix ||
    (this.redis.options && (this.redis.options.prefix || this.redis.options.keyPrefix)) ||
    ''
  this.timers = {}
  this.debug = debug || function() {}
}

RedisCache.prototype.add = function(key, value, time, timeoutCallback, group) {
  var that = this
  return new Promise(function(resolve, reject) {
    var expire = time + Date.now()
    var multi = that.redis
      .multi()
      .hset(key, 'value', JSON.stringify(value))
      .expireat(expire)
    if (group) {
      multi.hset(key, 'group', group).sadd('group:' + group, key)
    }

    multi.exec(function(err, res) {
      if (err || res === null) return reject(err)

      if (timeoutCallback && typeof timeoutCallback === 'function') {
        that.timers[key] = setTimeout(function() {
          that.debug('clearing expired entry for "' + key + '"')
          timeoutCallback(value, key)
        }, time)
      }
      resolve({
        value: value,
        expire: expire,
        timeout: that.timers[key],
      })
    })
  })
}

RedisCache.prototype.clear = function(target) {
  var that = this
  return new Promise(function(resolve, reject) {
    if (!target) {
      that.debug('clearing entire index')
      return resolve(that._clearAll())
    }

    var group = 'group:' + target
    that.redis.scard(group, function(err, groupCount) {
      if (err) return reject(err)

      groupCount = parseInt(groupCount, 10)
      if (groupCount > 0) {
        that.debug('clearing group "' + target + '"')
        var multi = that.redis.multi()
        var cursor = '0'
        var match = null
        var count = String(Math.min(100, groupCount))

        var clearGroup = function(group, cursor, match, count) {
          return that
            ._sscan(group, cursor, match, count)
            .then(function(cursorAndKeys) {
              var cursor = cursorAndKeys[0]
              var keys = cursorAndKeys[1]

              if (keys.length === 0) {
                if (cursor === '0') {
                  multi.del(group)
                  return
                }
                return clearGroup(group, cursor, match, count)
              }

              multi.del(keys)
              keys.forEach(function(key) {
                that.debug('clearing cached entry for "' + key + '"')
                clearTimeout(that.timers[key])
              })
              if (cursor === '0') {
                multi.del(group)
                return
              }
              return clearGroup(group, cursor, match, count)
            })
            .catch(reject)
        }

        return clearGroup(group, cursor, match, count).then(function() {
          multi.exec(function(err, deleteCounts) {
            if (err || deleteCounts === null) return reject(err)

            var deleteCount = deleteCounts.reduce(function(memo, deleteCount) {
              return memo + parseInt(deleteCount, 10)
            }, 0)
            resolve(deleteCount)
          })
        })
      } else {
        that.debug('clearing cached entry for "' + target + '"')
        that.redis.hget(target, 'group', function(err, group) {
          if (err) return reject(err)

          if (!group) {
            that.redis.del(target, function(err, deleteCount) {
              if (err) reject(err)
              else {
                clearTimeout(that.timers[target])
                resolve(parseInt(deleteCount, 10))
              }
            })
          } else {
            that.redis
              .multi()
              .srem('group:' + group, target)
              .del(target)
              .exec(function(err, res) {
                if (err || res === null) return reject(err)

                clearTimeout(that.timers[target])
                resolve(1)
              })
          }
        })
      }
    })
  })
}

RedisCache.prototype.get = function(key) {
  var that = this
  return new Promise(function(resolve, reject) {
    that.redis.hget(key, 'value', function(err, value) {
      if (err) return reject(err)
      if (value === null) return resolve({ value: value })

      that.redis.pttl(key, function(err, time) {
        if (err) return reject(err)
        if (time < 0) return resolve({ value: null })

        resolve({
          value: JSON.parse(value),
          expire: time + Date.now(),
          timeout: that.timers[key] || null, // available if at same node process
        })
      })
      resolve(value)
    })
  })
}

RedisCache.prototype.getValue = function(key) {
  var that = this
  return new Promise(function(resolve, reject) {
    that.redis.hget(key, 'value', function(err, value) {
      if (err) reject(err)
      else resolve(JSON.parse(value))
    })
  })
}

RedisCache.prototype.getIndex = function(group) {
  var that = this
  return new Promise(function(resolve, reject) {
    var cursor = '0'
    if (group) {
      group = 'group:' + group
      var groupKeys = []
      var smembers = function(group, cursor) {
        return that
          ._sscan(group, cursor)
          .then(function(cursorAndKeys) {
            var cursor = cursorAndKeys[0]
            var keys = cursorAndKeys[1]
            groupKeys = groupKeys.concat(keys)

            if (cursor === '0') return groupKeys
            return smembers(group, cursor)
          })
          .catch(reject)
      }

      resolve(smembers(group, cursor))
    } else {
      var index = {
        all: [],
        groups: {},
      }
      var groups = []
      var match = that.prefix && that.prefix + '*'

      var getAll = function(cursor, match) {
        return that
          ._scan(cursor, match)
          .then(function(cursorAndKeys) {
            var cursor = cursorAndKeys[0]
            var keys = cursorAndKeys[1]

            keys = that._removePrefix(keys)
            keys.forEach(function(k) {
              var isGroup = k.length !== (k = k.replace(/^group:/, '')).length
              if (isGroup) groups.push(k)
              else index.all.push(k)
            })

            if (cursor === '0') {
              return Promise.all(
                groups.map(function(group) {
                  return that.getIndex(group)
                })
              ).then(function(groupValues) {
                groupValues.forEach(function(v, i) {
                  index.groups[groups[i]] = v
                })
                return index
              })
            } else return getAll(cursor, match)
          })
          .catch(reject)
      }

      resolve(getAll(cursor, match))
    }
  })
}

RedisCache.prototype._scan = function(cursor, match, count) {
  if (!cursor) cursor = '0'
  if (!count) count = '10'

  var that = this
  return new Promise(function(resolve, reject) {
    var args = [cursor, match && 'MATCH', match && match, 'COUNT', count].filter(Boolean)
    that.redis.scan(args, function(err, cursorAndKeys) {
      if (err) return reject(err)

      resolve(cursorAndKeys)
    })
  })
}

RedisCache.prototype._sscan = function(key, cursor, match, count) {
  if (!cursor) cursor = '0'
  if (!count) count = '10'

  var that = this
  return new Promise(function(resolve, reject) {
    var args = [key, cursor, match && 'MATCH', match && match, 'COUNT', count].filter(Boolean)
    that.redis.sscan(args, function(err, cursorAndKeys) {
      if (err) return reject(err)

      resolve(cursorAndKeys)
    })
  })
}

RedisCache.prototype._clearAll = function() {
  var that = this
  return new Promise(function(resolve, reject) {
    if (!that.prefix) {
      that.redis.dbsize(function(err, count) {
        if (err) return reject(err)

        that.redis.flushdb(function() {
          Object.keys(that.timers).forEach(function(key) {
            clearTimeout(that.timers[key])
          })
          resolve(parseInt(count, 10))
        })
      })
    } else {
      var deleteCount = 0
      var cursor = '0'
      var match = that.prefix + '*'

      var deleteAll = function(cursor, match) {
        return that
          ._scan(cursor, match)
          .then(function(cursorAndKeys) {
            var cursor = cursorAndKeys[0]
            var keys = cursorAndKeys[1]

            if (keys.length === 0) {
              if (cursor === '0') return deleteCount
              return deleteAll(cursor, match)
            }

            keys = that._removePrefix(keys)
            that.redis.del(keys, function(err, removedCount) {
              if (err) throw err
              deleteCount += parseInt(removedCount, 10)

              keys.forEach(function(key) {
                clearTimeout(that.timers[key])
              })
              if (cursor === '0') return deleteCount
              return deleteAll(cursor, match)
            })
          })
          .catch(reject)
      }

      return resolve(deleteAll(cursor, match))
    }
  })
}

RedisCache.prototype._removePrefix = (function() {
  function isArray(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]'
  }
  function removePrefix(str, prefix) {
    var hasPrefix = str.indexOf(prefix) === 0
    return hasPrefix ? str.slice(prefix.length) : str
  }

  return function(keys) {
    if (!this.prefix) return keys
    if (isArray(keys)) {
      var that = this
      return keys.map(function(key) {
        return removePrefix(key, that.prefix)
      })
    } else return removePrefix(keys, this.prefix)
  }
})()

module.exports = RedisCache
