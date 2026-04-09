import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'

@Injectable()
export class RequestContextService {
  constructor(private readonly cls: ClsService) {}

  get requestId(): string | null {
    return this.cls.get('requestId') ?? null
  }

  get userId(): string | null {
    return this.cls.get('userId') ?? null
  }

  get orgId(): string | null {
    return this.cls.get('orgId') ?? null
  }

  get personId(): string | null {
    return this.cls.get('personId') ?? null
  }

  get correlationId(): string | null {
    return this.cls.get('correlationId') ?? this.requestId
  }

  getAll() {
    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
      userId: this.userId,
      orgId: this.orgId,
      personId: this.personId,
    }
  }
}
