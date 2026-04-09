import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-google-oauth20'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { readGoogleOAuthEnv } from '../common/config/google-oauth-env'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(config: ConfigService) {
    const googleOAuthEnv = readGoogleOAuthEnv(config)

    super({
      clientID: googleOAuthEnv.clientId || 'disabled-google-client-id',
      clientSecret: googleOAuthEnv.clientSecret || 'disabled-google-client-secret',
      callbackURL:
        googleOAuthEnv.redirectUrl ||
        'http://localhost:3010/api/auth/google/callback',
      scope: ['email', 'profile'],
    })

    if (!googleOAuthEnv.clientId || !googleOAuthEnv.clientSecret || !googleOAuthEnv.redirectUrl) {
      this.logger.warn(
        'Google OAuth sem configuração completa. Endpoints serão rejeitados até configurar GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (ou GOOGLE_SECRET)/GOOGLE_REDIRECT_URL (ou GOOGLE_REDIRECT_URI).',
      )
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile
    const user = {
      email: emails?.[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos?.[0]?.value,
      accessToken,
    }
    done(null, user)
  }
}
