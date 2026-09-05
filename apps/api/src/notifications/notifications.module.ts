import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EMAIL_SENDER } from './delivery/email-sender';
import { TwilioEmailSender } from './delivery/twilio.email-sender';
import { SMS_SENDER } from './delivery/sms-sender';
import { TwilioSmsSender } from './delivery/twilio.sms-sender';

/**
 * Notifications module — in-app feed plus transactional email (Twilio SendGrid)
 * and SMS (Twilio Messaging). Fired on match creation to both the client and
 * the surveyor. Email degrades to a log-only stub when SendGrid is not
 * configured; SMS requires Twilio credentials (match SMS is best-effort;
 * phone OTP fails closed).
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EMAIL_SENDER, useClass: TwilioEmailSender },
    { provide: SMS_SENDER, useClass: TwilioSmsSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
