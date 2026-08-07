import { describe, expect, it } from 'vitest'
import { oauthRedirectUri, peopleAuthorizationUrl, safeLoginRedirect } from './oauth'

describe('OAuth URL helpers', () => {
  it('keeps the generated authorization path while replacing the People origin', () => {
    expect(peopleAuthorizationUrl(
      'http://people-internal:5177/oauth/authorize?client_id=permission-ui&state=abc',
      'http://10.251.237.216:5177',
    )).toBe('http://10.251.237.216:5177/oauth/authorize?client_id=permission-ui&state=abc')
  })

  it('resolves a relative callback against the current platform origin', () => {
    expect(oauthRedirectUri('/oauth/callback', 'http://10.251.237.216:5178'))
      .toBe('http://10.251.237.216:5178/oauth/callback')
  })

  it('only accepts local application redirects', () => {
    expect(safeLoginRedirect('/gateway/routes?serviceId=2')).toBe('/gateway/routes?serviceId=2')
    expect(safeLoginRedirect('https://example.com')).toBe('/permission/dashboard')
    expect(safeLoginRedirect('//example.com')).toBe('/permission/dashboard')
  })
})
