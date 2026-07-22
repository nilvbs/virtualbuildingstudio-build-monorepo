import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EMAIL_SENDER } from './delivery/email-sender';
import { SesEmailSender } from './delivery/ses.email-sender';
import { SMS_SENDER } from './delivery/sms-sender';
import { SnsSmsSender } from './delivery/sns.sms-sender';

/**
 * Notifications module — in-app feed plus transactional email (SES) and SMS
 * (SNS) delivery. Fired on match creation to both the client and the surveyor.
 * Senders degrade to a log-only stub when their provider is not configured, so
 * local dev and CI work without credentials.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EMAIL_SENDER, useClass: SesEmailSender },
    { provide: SMS_SENDER, useClass: SnsSmsSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
