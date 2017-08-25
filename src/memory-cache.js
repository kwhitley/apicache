'use strict';

class MemoryCache {
  constructor() {
    this.cache = new Map()
  }

  get(key) {
    return this.cache.get(key)
  }

  getValue(key) {
    let entry = this.get(key)

    return entry && entry.value
  }

  set(key, value, time, timeoutCallback) {
    let instance = this

    let entry = {
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

  delete(key) {
    let entry = this.cache.get(key)

    // clear existing timeout for entry, if exists
    if (entry) clearTimeout(entry.timeout)

    this.cache.delete(key)

    return this
  }

  clear() {
    this.cache.forEach(key => this.delete(key))

    return this
  }
}

module.exports = MemoryCache
