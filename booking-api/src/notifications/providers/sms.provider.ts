// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio') as typeof import('twilio');

export interface SmsPayload {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(payload: SmsPayload): Promise<void>;
}

export class TwilioSmsProvider implements SmsProvider {
  async send(payload: SmsPayload): Promise<void> {
    const accountSid    = process.env.TWILIO_ACCOUNT_SID;   // AC... or SK...
    const mainAccountSid = process.env.TWILIO_MAIN_ACCOUNT_SID; // needed when accountSid is SK...
    const authToken     = process.env.TWILIO_AUTH_TOKEN ?? process.env.TWILIO_API_CLIENT_SECRET;
    const fromNumber    = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_CLIENT_NUMBER;

    const isPlaceholder = !accountSid || !authToken ||
      accountSid.startsWith('AC_placeholder') || accountSid.startsWith('AC_test');

    if (isPlaceholder) {
      console.log(`[SMS stub] To: ${payload.to} | Body: ${payload.body}`);
      return;
    }

    try {
      // API Key auth: accountSid starts with SK → needs real account SID as third arg
      const client = accountSid.startsWith('SK')
        ? twilio(accountSid, authToken, { accountSid: mainAccountSid ?? accountSid })
        : twilio(accountSid, authToken);

      await client.messages.create({ from: fromNumber, to: payload.to, body: payload.body });
      console.log(`[SMS sent] To: ${payload.to}`);
    } catch (error) {
      console.error('[Twilio Error]', error);
      throw error;
    }
  }
}
