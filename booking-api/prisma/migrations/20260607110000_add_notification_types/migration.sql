-- AlterEnum: add REMINDER_72H and FOLLOW_UP values to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_72H';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
