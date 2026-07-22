import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { SmsMessage, SmsSender } from './sms-sender';

/**
 * Transactional SMS via Amazon SNS. Uses the default AWS credential chain
 * (ECS task role in prod; env/profile locally). If AWS_REGION is unset,
 * degrades to a log-only stub. Delivery failures are logged, never thrown.
 */
@Injectable()
export class SnsSmsSender implements SmsSender {
  private readonly logger = new Logger(SnsSmsSender.name);
  private readonly senderId?: string;
  private readonly configured: boolean;
  private client?: SNSClient;

  constructor(config: ConfigService) {
    this.senderId = config.get<string>('SNS_SMS_SENDER_ID') || undefined;
    const region = config.get<string>('AWS_REGION') || config.get<string>('SNS_REGION');
    this.configured = Boolean(region);
    if (this.configured && region) {
      this.client = new SNSClient({ region });
      this.logger.log(`SNS SMS enabled (region=${region})`);
    } else {
      this.logger.warn(
        'SNS SMS stubbed: set AWS_REGION (and credentials / task role), then restart the API',
      );
    }
  }

  async send(msg: SmsMessage): Promise<void> {
    if (!this.configured || !this.client) {
      this.logger.warn(`[stub sms] to=${msg.to} body="${msg.body}"`);
      return;
    }

    try {
      const result = await this.client.send(
        new PublishCommand({
          PhoneNumber: msg.to,
          Message: msg.body,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            ...(this.senderId
              ? {
                  'AWS.SNS.SMS.SenderID': {
                    DataType: 'String',
                    StringValue: this.senderId,
                  },
                }
              : {}),
          },
        }),
      );
      this.logger.log(`SNS SMS to ${msg.to} MessageId=${result.MessageId ?? 'n/a'}`);
    } catch (err) {
      this.logger.warn(`SNS SMS to ${msg.to} failed: ${(err as Error).message}`);
    }
  }
}
