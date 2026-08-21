import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { EmailMessage, EmailSender } from './email-sender';

/**
 * Transactional email via Amazon SES. Uses the default AWS credential chain
 * (ECS task role in prod; env/profile locally). If SES_FROM_EMAIL / AWS_REGION
 * are unset, degrades to a log-only stub so local dev and CI keep working.
 * Delivery failures are logged, never thrown.
 */
@Injectable()
export class SesEmailSender implements EmailSender {
  private readonly logger = new Logger(SesEmailSender.name);
  private readonly from?: string;
  private readonly fromName: string;
  private readonly configurationSet?: string;
  private readonly configured: boolean;
  private client?: SESv2Client;

  constructor(config: ConfigService) {
    this.from = config.get<string>('SES_FROM_EMAIL');
    this.fromName = config.get<string>('SES_FROM_NAME') ?? 'BLD';
    this.configurationSet = config.get<string>('SES_CONFIGURATION_SET') || undefined;
    const region = config.get<string>('AWS_REGION') || config.get<string>('SES_REGION');
    const accessKeyId = (
      config.get<string>('AWS_ACCESS_KEY_ID') || process.env.AWS_ACCESS_KEY_ID
    )?.trim();
    const secretAccessKey = (
      config.get<string>('AWS_SECRET_ACCESS_KEY') || process.env.AWS_SECRET_ACCESS_KEY
    )?.trim();
    this.configured = Boolean(this.from && region && accessKeyId && secretAccessKey);
    if (this.configured && region && accessKeyId && secretAccessKey) {
      this.client = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async send(msg: EmailMessage): Promise<void> {
    if (!this.configured || !this.client || !this.from) {
      this.logger.log(`[stub email] to=${msg.to} subject="${msg.subject}"`);
      return;
    }

    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: `${this.fromName} <${this.from}>`,
          Destination: { ToAddresses: [msg.to] },
          Content: {
            Simple: {
              Subject: { Data: msg.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: msg.text, Charset: 'UTF-8' },
                ...(msg.html
                  ? { Html: { Data: msg.html, Charset: 'UTF-8' } }
                  : {}),
              },
            },
          },
          ...(this.configurationSet
            ? { ConfigurationSetName: this.configurationSet }
            : {}),
        }),
      );
    } catch (err) {
      this.logger.warn(`SES send to ${msg.to} failed: ${(err as Error).message}`);
    }
  }
}
