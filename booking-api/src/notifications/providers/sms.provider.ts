// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio') as typeof import('twilio');
import { Logger } from '@nestjs/common';

export interface SmsPayload {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(payload: SmsPayload): Promise<void>;
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);

  async send(payload: SmsPayload): Promise<void> {
    const accountSid    = process.env.TWILIO_ACCOUNT_SID;   // AC... or SK...
    const mainAccountSid = process.env.TWILIO_MAIN_ACCOUNT_SID; // needed when accountSid is SK...
    const authToken     = process.env.TWILIO_AUTH_TOKEN ?? process.env.TWILIO_API_CLIENT_SECRET;
    const fromNumber    = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_CLIENT_NUMBER;

    const isPlaceholder = !accountSid || !authToken ||
      accountSid.startsWith('AC_placeholder') || accountSid.startsWith('AC_test');

    if (isPlaceholder) {
      this.logger.debug('[SMS stub] message queued (recipient redacted)');
      return;
    }

    try {
      // API Key auth: accountSid starts with SK → needs real account SID as third arg
      const client = accountSid.startsWith('SK')
        ? twilio(accountSid, authToken, { accountSid: mainAccountSid ?? accountSid })
        : twilio(accountSid, authToken);

      await client.messages.create({ from: fromNumber, to: payload.to, body: payload.body });
      this.logger.log('[SMS sent] message delivered');
    } catch (error) {
      this.logger.error('[Twilio Error]', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}
