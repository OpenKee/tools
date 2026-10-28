class IntersectionObserverStub {
  constructor(callback) {
    this.callback = callback
    globalThis.__lastIntersectionObserver = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger() {
    this.callback([{ isIntersecting: true }], this)
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub
globalThis.__triggerIntersection = () => globalThis.__lastIntersectionObserver?.trigger()

window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
})
