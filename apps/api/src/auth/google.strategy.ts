import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-google-oauth20'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(private config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'disabled-google-client-id'
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'disabled-google-client-secret'
    const callbackURL =
      config.get<string>('GOOGLE_REDIRECT_URL') || 'http://localhost:3000/auth/google/callback'

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    })

    if (
      !config.get<string>('GOOGLE_CLIENT_ID') ||
      !config.get<string>('GOOGLE_CLIENT_SECRET') ||
      !config.get<string>('GOOGLE_REDIRECT_URL')
    ) {
      this.logger.warn(
        'Google OAuth sem configuração completa. Endpoints serão rejeitados até configurar GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL.',
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
