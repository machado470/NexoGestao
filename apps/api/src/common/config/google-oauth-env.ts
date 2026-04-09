import { ConfigService } from '@nestjs/config'

type NullableString = string | null

type GoogleOAuthEnv = {
  clientId: NullableString
  clientSecret: NullableString
  redirectUrl: NullableString
}

function readFirstConfigured(config: ConfigService, names: string[]): NullableString {
  for (const name of names) {
    const fromConfig = config.get<string>(name)
    const fromProcess = process.env[name]
    const value = (fromConfig ?? fromProcess ?? '').trim()
    if (value) return value
  }

  return null
}

export function readGoogleOAuthEnv(config: ConfigService): GoogleOAuthEnv {
  return {
    clientId: readFirstConfigured(config, ['GOOGLE_CLIENT_ID']),
    clientSecret: readFirstConfigured(config, [
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_SECRET',
    ]),
    redirectUrl: readFirstConfigured(config, [
      'GOOGLE_REDIRECT_URL',
      'GOOGLE_REDIRECT_URI',
    ]),
  }
}

export function isGoogleOAuthConfigured(config: ConfigService): boolean {
  const env = readGoogleOAuthEnv(config)
  return Boolean(env.clientId && env.clientSecret && env.redirectUrl)
}
