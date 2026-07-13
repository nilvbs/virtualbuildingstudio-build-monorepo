import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EMAIL_SENDER } from './delivery/email-sender';
import { SendgridEmailSender } from './delivery/sendgrid.email-sender';
import { SMS_SENDER } from './delivery/sms-sender';
import { TwilioSmsSender } from './delivery/twilio.sms-sender';

/**
 * Notifications module — in-app feed plus transactional email (SendGrid) and
 * SMS (Twilio) delivery. Fired on match creation to both the client and the
 * surveyor. Senders degrade to a log-only stub when their provider is not
 * configured, so local dev and CI work without credentials.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EMAIL_SENDER, useClass: SendgridEmailSender },
    { provide: SMS_SENDER, useClass: TwilioSmsSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
