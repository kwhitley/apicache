class MemoryCache {
  constructor() {
    this.cache = {}
    this.size = 0
  }

  // add a cache entry (referenced by key)
  add(key, value, time, timeoutCallback) {
    let old = this.cache[key]
    let instance = this

    let entry = {
      value: value,
      expire: time + Date.now(),
      timeout: setTimeout(function() {
        instance.delete(key)
        return timeoutCallback && typeof timeoutCallback === 'function' && timeoutCallback(value, key)
      }, time)
    }

    this.cache[key] = entry
    this.size = Object.keys(this.cache).length

    return entry
  }

  // deletes a cached entry by key
  delete(key) {
    let entry = this.cache[key]

    if (entry) {
      clearTimeout(entry.timeout)
    }

    delete this.cache[key]

    this.size = Object.keys(this.cache).length

    return null
  }

  // returns a cached entry by key
  get(key) {
    let entry = this.cache[key]

    return entry
  }

  // returns just the value of cached entry (by key)
  getValue(key) {
    let entry = this.get(key)

    return entry && entry.value
  }

  // clears entire cache
  clear() {
    Object.keys(this.cache).forEach(key => this.delete(key), this)

    return true
  }
}

export default MemoryCache
