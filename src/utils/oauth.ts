export function oauthRedirectUri(configuredValue: string | undefined, currentOrigin: string) {
  return new URL(configuredValue || '/oauth/callback', currentOrigin).toString()
}

export function peopleAuthorizationUrl(authorizationUrl: string, configuredOrigin: string | undefined) {
  const origin = String(configuredOrigin || '').trim()
  if (!origin) return authorizationUrl
  const generated = new URL(authorizationUrl)
  return new URL(`${generated.pathname}${generated.search}${generated.hash}`, new URL(origin).origin).toString()
}

export function safeLoginRedirect(value: unknown) {
  const redirect = typeof value === 'string' ? value : ''
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/permission/dashboard'
}
