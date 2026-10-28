import test from 'node:test'
import assert from 'node:assert/strict'
import { githubAPI, githubCachedAPI } from '../src/ok.js'

const realFetch = globalThis.fetch

function stubFetch(response, calls = []) {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts })
    return response
  }
  return calls
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === String(name).toLowerCase())
        return key ? headers[key] : null
      },
    },
    json: async () => body,
  }
}

test.afterEach(() => {
  globalThis.fetch = realFetch
})

test('githubAPI returns the parsed body on 200', async () => {
  const calls = stubFetch(jsonResponse({ login: 'openkee' }))
  const data = await githubAPI('https://api.github.com/users/openkee')
  assert.deepEqual(data, { login: 'openkee' })
  assert.equal(calls[0].opts.headers.Accept, 'application/vnd.github+json')
  assert.equal(calls[0].opts.headers.Authorization, undefined)
})

test('githubAPI sends a bearer token when one is given', async () => {
  const calls = stubFetch(jsonResponse({}))
  await githubAPI('https://api.github.com/user', { token: 'abc123' })
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer abc123')
})

test('githubAPI maps 404 to not_found, not to a rate limit', async () => {
  stubFetch(jsonResponse({ message: 'Not Found' }, { status: 404 }))
  await assert.rejects(githubAPI('https://api.github.com/repos/x/y'), { message: 'not_found' })
})

test('githubAPI maps 202 to null while GitHub computes stats', async () => {
  stubFetch(jsonResponse({ message: 'Accepted' }, { status: 202 }))
  assert.equal(await githubAPI('https://api.github.com/repos/x/y/stats'), null)
})

test('githubAPI reports rate_limit with resetAt on a real 403 rate limit', async () => {
  stubFetch(
    jsonResponse(
      { message: 'API rate limit exceeded for 1.2.3.4.' },
      { status: 403, headers: { 'x-ratelimit-reset': '1700000000' } },
    ),
  )
  await assert.rejects(githubAPI('https://api.github.com/search/repositories?q=a'), (err) => {
    assert.equal(err.message, 'rate_limit')
    assert.ok(err.resetAt instanceof Date)
    assert.equal(err.resetAt.getTime(), 1700000000 * 1000)
    return true
  })
})

test('githubAPI reports rate_limit on 429 too', async () => {
  stubFetch(jsonResponse({ message: 'You have exceeded a secondary rate limit.' }, { status: 429 }))
  await assert.rejects(githubAPI('https://api.github.com/search/code?q=a'), { message: 'rate_limit' })
})

test('githubAPI treats a 403 without a rate-limit message as forbidden', async () => {
  stubFetch(jsonResponse({ message: 'Resource not accessible by integration' }, { status: 403 }))
  await assert.rejects(githubAPI('https://api.github.com/repos/x/y'), { message: 'forbidden' })
})

test('githubAPI surfaces the message of other HTTP errors', async () => {
  stubFetch(jsonResponse({ message: 'Server Error' }, { status: 500 }))
  await assert.rejects(githubAPI('https://api.github.com/repos/x/y'), { message: 'Server Error' })
})

test('githubCachedAPI reuses a successful response within the TTL', async () => {
  const calls = stubFetch(jsonResponse({ items: [] }))
  const url = 'https://api.github.com/search/repositories?q=cache-hit'
  await githubCachedAPI(url)
  await githubCachedAPI(url)
  assert.equal(calls.length, 1)
})

test('githubCachedAPI does not cache failures', async () => {
  const calls = stubFetch(jsonResponse({ message: 'Not Found' }, { status: 404 }))
  const url = 'https://api.github.com/search/repositories?q=cache-miss'
  await assert.rejects(githubCachedAPI(url), { message: 'not_found' })
  await assert.rejects(githubCachedAPI(url), { message: 'not_found' })
  assert.equal(calls.length, 2)
})

test('githubCachedAPI isolates entries by GitHub token', async () => {
  const calls = stubFetch(jsonResponse({ items: [] }))
  const url = 'https://api.github.com/search/repositories?q=cache-token'
  await githubCachedAPI(url, { token: 'token-a' })
  await githubCachedAPI(url, { token: 'token-b' })
  await githubCachedAPI(url, { token: 'token-a' })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer token-a')
  assert.equal(calls[1].opts.headers.Authorization, 'Bearer token-b')
})
