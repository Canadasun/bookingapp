import { Module } from '@nestjs/common';
import { MessagesController, BusinessMessagesController, SmsWebhookController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController, BusinessMessagesController, SmsWebhookController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
