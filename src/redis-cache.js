var stream = require('stream')
var Redlock = require('redlock')
function generateUuidV4(a, b) {
  for (
    b = a = '';
    a++ < 36;
    b += (a * 51) & 52 ? (a ^ 15 ? 8 ^ (Math.random() * (a ^ 20 ? 16 : 4)) : 4).toString(16) : '-'
  );
  return b
}

function RedisCache(options, debug) {
  this.redis = options.redisClient
  this.prefix =
    options.redisPrefix ||
    (this.redis.options && (this.redis.options.prefix || this.redis.options.keyPrefix)) ||
    ''
  this.timers = {}
  this.debug = debug || function() {}
  this.redlock = new Redlock([this.redis], {
    retryCount: 0,
  })
  this.isIoRedis = !!this.redis.getBuffer
  if (!this.isIoRedis) {
    // A compressed response can't be converted losslessly to a utf-8 string.
    // It can be fetched as a buffer (encoded as binary/latin1 or even utf8),
    // so use ioredis buffer returning fn versions.
    // For node-redis, key param should be Buffer.from(key) with detect_buffers: true
    // or else the regular functions will return utf-8 strings
    var that = this
    var getBufferFnVersion = function(fn) {
      return function() {
        arguments[0] = Buffer.from(arguments[0], 'utf8') // key
        return fn.apply(that.redis, arguments)
      }
    }
    this.redis.getrangeBuffer = getBufferFnVersion(this.redis.getrange)
    this.redis.getBuffer = getBufferFnVersion(this.redis.get)
  }
}

var DEFAULT_LOCK_PTTL = 30 * 1000 // 30s will be the response init limit
RedisCache.prototype._acquireLock = function(key, pttl) {
  return this.redlock.lock('lock:' + key, pttl || DEFAULT_LOCK_PTTL)
}

var DEFAULT_HIGH_WATER_MARK = 16384
RedisCache.prototype.createWriteStream = (function() {
  var TYPICAL_3G_DOWNLOAD_SPEED = (1000000 * 0.1) / 8 / 1000 // 0.1 Mbit/s in bytes/ms
  var POOR_SERVER_TO_REDIS_LATENCY = 170 // 170 ms/fetch if redis instance is far from server
  var A_QUARTER_OF_LOCK_PTTL = Math.round(DEFAULT_LOCK_PTTL / 4)

  return function(key, getValue, time, timeoutCallback, getGroup, highWaterMark) {
    var that = this
    return this._acquireLock(key)
      .then(function(lock) {
        if (!highWaterMark) highWaterMark = DEFAULT_HIGH_WATER_MARK
        var currentLockPttl = DEFAULT_LOCK_PTTL
        var moment = Date.now()
        var expireAt = time + moment
        var multi = that.redis.multi()
        var dataToken = generateUuidV4()
        var dataKey = 'data:' + dataToken + ':' + key
        var byteLength = 0
        var cacheEncoding
        var hasErrored = false
        function releaseLock() {
          lock.unlock().catch(function(err) {
            that.debug('error in redisCache.getWriteStream function', err)
          })
        }

        // if node < 8, the wstream won't call _final
        var final = function(cb) {
          if (hasErrored) return cb()

          try {
            var chunkCount = Math.ceil((byteLength || 1) / highWaterMark)
            var serverToRedisLatency = POOR_SERVER_TO_REDIS_LATENCY * chunkCount
            var dataMaxAllowedTimeToRead = Math.round(
              byteLength / TYPICAL_3G_DOWNLOAD_SPEED + serverToRedisLatency
            )
            var group = getGroup()
            var value = getValue()
            if (cacheEncoding === 'buffer') {
              if ((value.headers['content-encoding'] || 'identity') === 'identity') {
                value.encoding = 'utf8'
              } else value.encoding = 'binary' // 'alias to latin1 from node >= v6.4.0'
            } else {
              value.encoding = cacheEncoding || 'utf8'
            }

            multi
              .hset(key, 'data-token', dataToken)
              .hset(key, 'data-extra-pttl', dataMaxAllowedTimeToRead)
              .hset(key, 'headers', JSON.stringify(value.headers))
              .hset(key, 'timestamp', value.timestamp)
              .hset(key, 'status', value.status)
              .hset(key, 'encoding', value.encoding)
            if (group) {
              multi.hset(key, 'group', group)
              multi.sadd('group:' + group, key)
            }
            multi.pexpireat(key, expireAt)
            multi.pexpireat(dataKey, expireAt + dataMaxAllowedTimeToRead)

            multi.exec(function(err, res) {
              if (err || res === null) cb(err)

              if (timeoutCallback && typeof timeoutCallback === 'function') {
                that.timers[key] = setTimeout(function() {
                  that.debug('clearing expired entry for "' + key + '"')
                  timeoutCallback(value, key)
                }, time)
              }
              cb()
            })
          } catch (err) {
            cb(err)
          }
        }

        return new stream.Writable({
          highWaterMark: highWaterMark,
          write(chunk, encoding, cb) {
            if (hasErrored) return cb()

            try {
              multi.append(dataKey, chunk)

              if (!cacheEncoding && encoding) cacheEncoding = encoding
              byteLength += Buffer.byteLength(chunk, encoding)
              var now = Date.now()
              var elapsed = Date.now() - moment
              moment = now
              currentLockPttl -= elapsed
              if (currentLockPttl < A_QUARTER_OF_LOCK_PTTL) {
                currentLockPttl = A_QUARTER_OF_LOCK_PTTL * 2
                lock
                  .extend(currentLockPttl)
                  .then(function() {
                    cb()
                  })
                  // will error if lock already expired
                  .catch(function() {
                    that
                      ._acquireLock(key, currentLockPttl)
                      .then(function(newLock) {
                        lock = newLock
                        cb()
                      })
                      .catch(function(err) {
                        cb(err)
                      })
                  })
              } else {
                cb()
              }
            } catch (err) {
              cb(err)
            }
          },
          final: final,
        })
          .on('error', function() {
            hasErrored = true
            multi.discard()
            releaseLock()
          })
          .on('finish', function() {
            // if node >= 8
            if (typeof this._final === 'function') return releaseLock()

            new Promise(function(resolve) {
              final(resolve)
            }).then(releaseLock)
          })
      })
      .catch(function() {
        return new stream.Writable({
          write(_c, e, cb) {
            cb()
          },
        })
      })
  }
})()

var isNodeGte10 = (function(ret) {
  return function() {
    if (ret !== undefined) return ret

    return (ret = parseInt(process.versions.node.split('.')[0], 10) >= 10)
  }
})()
RedisCache.prototype.createReadStream = function(key, dataToken, encoding, highWaterMark) {
  if (!highWaterMark) highWaterMark = DEFAULT_HIGH_WATER_MARK
  var dataKey = 'data:' + dataToken + ':' + key
  var returnBuffers
  if (this.isIoRedis) {
    returnBuffers = true
  } else {
    returnBuffers =
      (this.redis.options &&
        (this.redis.options.detect_buffers || this.redis.options.return_buffers)) ||
      false
  }

  var that = this
  var start = 0
  var end = highWaterMark - 1
  var getChunk = function() {
    return new Promise(function(resolve, reject) {
      try {
        that.redis.getrangeBuffer(dataKey, start, end, function(err, chunk) {
          if (err) return reject(err)

          if (Buffer.byteLength(chunk || '', encoding) === 0) {
            chunk = null // done reading
          } else {
            // faster instead of checking !Buffer.isBuffer(chunk)
            if (!returnBuffers) chunk = Buffer.from(chunk, encoding)
            start = end + 1
            end = end + highWaterMark
          }
          resolve(chunk)
        })
      } catch (err) {
        reject(err)
      }
    })
  }
  var pushChunk = function(push, retry = 3) {
    return getChunk()
      .catch(function(err) {
        if (retry-- === 0) throw err

        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(pushChunk(push, retry))
          }, 20)
        })
      })
      .then(function(chunk) {
        var shouldPush = push(chunk)
        // isNodeGte10() needed for keeping async chunk push
        if (isNodeGte10() && shouldPush) return pushChunk(push)
      })
  }

  return new stream.Readable({
    highWaterMark: highWaterMark,
    read() {
      var that = this
      pushChunk(this.push.bind(this)).catch(function(err) {
        that.emit('error', err)
      })
    },
  }).on('error', function() {
    this.unpipe()
    // if node < 8
    if (!this.destroy) return this.pause()
    this.destroy()
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
        var deleteCount = 1 // group

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

              return Promise.all(
                keys.map(function(key) {
                  return that._decrementDataExpiration(key, multi)
                })
              ).then(function() {
                deleteCount += keys.length
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
            })
            .catch(reject)
        }

        return clearGroup(group, cursor, match, count).then(function() {
          multi.exec(function(err, res) {
            if (err || res === null) return reject(err)
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
            var multi = that.redis.multi()
            group = 'group:' + group
            that._decrementDataExpiration(target, multi).then(function() {
              multi
                .srem(group, target)
                .del(target)
                .scard(group)
                .exec(function(err, res) {
                  if (err || res === null) return reject(err)

                  clearTimeout(that.timers[target])
                  var deleteCount = parseInt((res[2] || [null, 0])[1], 10)
                  var wasGroupDeleted = parseInt((res[3] || [null, 1])[1], 10) === 0
                  if (wasGroupDeleted) deleteCount++
                  resolve(deleteCount)
                })
            })
          }
        })
      }
    })
  })
}

RedisCache.prototype.get = function(key) {
  var that = this
  return this.getValue(key).then(function(value) {
    if (value === null) return { value: value }

    return new Promise(function(resolve, reject) {
      that.redis.getBuffer('data:' + value['data-token'] + ':' + key, function(err, data) {
        if (err) return reject(err)
        if (data !== null) value.data = data

        that.redis.pttl(key, function(err, time) {
          if (err) return reject(err)
          if (time < 0) return resolve({ value: null })

          resolve({
            value: value,
            expire: time + Date.now(),
            timeout: that.timers[key] || null, // available if at same node process
          })
        })
      })
    })
  })
}

RedisCache.prototype.getValue = function(key) {
  var that = this
  return new Promise(function(resolve, reject) {
    that.redis.hgetall(key, function(err, value) {
      if (err) reject(err)
      else {
        // ioredis hgetall empty value is {}, while node-redis is null
        if (value && Object.keys(value).length > 0) {
          value.key = key
          value.headers = JSON.parse(value.headers)
          value.status = parseInt(value.status, 10)
          value.timestamp = parseFloat(value.timestamp)
          value['data-extra-pttl'] = parseInt(value['data-extra-pttl'], 10)
        } else value = null
        resolve(value)
      }
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
              if (/^(lock|data):/.test(k)) return

              var isGroup = k.length !== (k = k.replace(/^group:/, '')).length
              if (isGroup) groups.push(k)
              else {
                index.all.push(k)
              }
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

// so that a response reading key data chunk by chunk won't error out
RedisCache.prototype._decrementDataExpiration = function(key, multi) {
  var that = this
  return new Promise(function(resolve) {
    that.redis.hmget(key, 'data-token', 'data-extra-pttl', function(err, res) {
      // key doesn't exist anymore
      if (err || res[0] === null || res[1] === null) return resolve()
      var dataKey = 'data:' + res[0] + ':' + key
      var pttl = res[1]

      if (multi) {
        multi.pexpire(dataKey, pttl)
        resolve()
      } else {
        that.redis.pexpire(dataKey, pttl, function() {
          resolve()
        })
      }
    })
  })
}

RedisCache.prototype._clearAll = function() {
  var that = this
  if (!this.prefix) {
    return new Promise(function(resolve, reject) {
      that.redis.dbsize(function(err, count) {
        if (err) return reject(err)

        that.redis.flushdb(function() {
          Object.keys(that.timers).forEach(function(key) {
            clearTimeout(that.timers[key])
          })
          resolve(parseInt(count, 10))
        })
      })
    })
  } else {
    var deleteCount = 0
    var cursor = '0'
    var match = that.prefix + '*'

    var deleteAll = function(cursor, match) {
      return that._scan(cursor, match).then(function(cursorAndKeys) {
        var cursor = cursorAndKeys[0]
        var keys = cursorAndKeys[1]

        if (keys.length === 0) {
          if (cursor === '0') return deleteCount
          return deleteAll(cursor, match)
        }

        keys = that._removePrefix(keys)
        return new Promise(function(resolve, reject) {
          that.redis.del(keys, function(err, removedCount) {
            if (err) return reject(err)
            deleteCount += parseInt(removedCount, 10)

            keys.forEach(function(key) {
              clearTimeout(that.timers[key])
            })
            if (cursor === '0') resolve(deleteCount)
            else resolve(deleteAll(cursor, match))
          })
        })
      })
    }

    return deleteAll(cursor, match)
  }
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
