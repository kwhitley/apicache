export function setLongTimeout(fn, delay) {
  var maxDelay = Math.pow(2, 31) - 1

  if (delay > maxDelay) {
    var args = arguments
    args[1] -= maxDelay

    return setTimeout(function () {
      setTimeout_.apply(undefined, args)
    }, maxDelay)
  }

  return setTimeout.apply(undefined, arguments)
}
