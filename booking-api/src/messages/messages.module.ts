import { Module } from '@nestjs/common';
import { MessagesController, BusinessMessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController, BusinessMessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
