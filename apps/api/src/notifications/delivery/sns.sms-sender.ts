import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { SmsMessage, SmsSender } from './sms-sender';

/**
 * Transactional SMS via Amazon SNS using AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
 * from env (IAM user access keys). Does not use an instance/task role.
 */
@Injectable()
export class SnsSmsSender implements SmsSender {
  private readonly logger = new Logger(SnsSmsSender.name);
  private readonly senderId?: string;
  private readonly configured: boolean;
  private client?: SNSClient;

  constructor(config: ConfigService) {
    this.senderId = config.get<string>('SNS_SMS_SENDER_ID')?.trim() || undefined;
    const region = (config.get<string>('AWS_REGION') || config.get<string>('SNS_REGION'))?.trim();
    const accessKeyId = (
      config.get<string>('AWS_ACCESS_KEY_ID') || process.env.AWS_ACCESS_KEY_ID
    )?.trim();
    const secretAccessKey = (
      config.get<string>('AWS_SECRET_ACCESS_KEY') || process.env.AWS_SECRET_ACCESS_KEY
    )?.trim();
    this.configured = Boolean(region && accessKeyId && secretAccessKey);
    if (this.configured && region && accessKeyId && secretAccessKey) {
      this.client = new SNSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`SNS SMS enabled (region=${region}, using AWS_ACCESS_KEY_ID from .env)`);
    } else {
      this.logger.warn(
        'SNS SMS disabled — set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env, then restart the API',
      );
    }
  }

  async send(msg: SmsMessage): Promise<{ messageId?: string }> {
    if (!this.configured || !this.client) {
      throw new Error(
        'SNS SMS is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env (IAM user keys, not a role).',
      );
    }

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
    const messageId = result.MessageId;
    this.logger.log(`SNS SMS to ${msg.to} MessageId=${messageId ?? 'n/a'}`);
    return { messageId };
  }
}
