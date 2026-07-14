import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity/identity-provider';
import { Inject } from '@nestjs/common';
import {
  rememberDevSignup,
  devAuthEnabled,
  devSubjectForEmail,
} from './dev-auth';
import { ensureMembership } from './memberships';

/**
 * Ensures the configured SUPER_ADMIN_EMAIL account exists as staffLevel=super_admin.
 * Password comes from SUPER_ADMIN_PASSWORD (never hardcode in source).
 */
@Injectable()
export class SuperAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = (this.config.get<string>('SUPER_ADMIN_EMAIL') ?? '').trim().toLowerCase();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? '';
    const phone = (this.config.get<string>('SUPER_ADMIN_PHONE') ?? '+10000000001').trim();
    const fullName = (this.config.get<string>('SUPER_ADMIN_NAME') ?? 'Super Admin').trim();

    if (!email) {
      this.logger.warn('SUPER_ADMIN_EMAIL unset — skipping super admin bootstrap');
      return;
    }
    if (!password) {
      this.logger.warn('SUPER_ADMIN_PASSWORD unset — cannot bootstrap super admin');
      return;
    }

    try {
      await this.ensureSuperAdmin({ email, password, phone, fullName });
    } catch (err) {
      this.logger.error(
        `Super admin bootstrap failed for ${email}: ${(err as Error).message}`,
      );
    }
  }

  private async ensureSuperAdmin(input: {
    email: string;
    password: string;
    phone: string;
    fullName: string;
  }): Promise<void> {
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      if (devAuthEnabled(this.config)) {
        const subject = devSubjectForEmail(input.email);
        rememberDevSignup(input.email, input.password, subject);
        user = await this.prisma.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            emailVerified: true,
            phoneVerified: true,
            authProvider: 'dev',
            authSubject: subject,
            roleHint: 'client',
          },
        });
        this.logger.log(`Created super admin user (dev) ${input.email}`);
      } else {
        const identity = await this.identity.createIdentity({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          password: input.password,
        });
        user = await this.prisma.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            emailVerified: identity.emailVerified,
            phoneVerified: true,
            authProvider: 'auth0',
            authSubject: identity.subject,
            roleHint: 'client',
          },
        });
        this.logger.log(`Created super admin user ${input.email}`);
      }
    } else if (devAuthEnabled(this.config) && user.authSubject) {
      rememberDevSignup(input.email, input.password, user.authSubject);
    }

    await ensureMembership(this.prisma, user.id, 'admin');
    await this.prisma.adminProfile.update({
      where: { userId: user.id },
      data: {
        staffLevel: 'super_admin',
        permissionPreset: 'full',
        permissions: [],
        title: 'Super Admin',
      },
    });
    this.logger.log(`Ensured super_admin privileges for ${input.email}`);
  }
}
