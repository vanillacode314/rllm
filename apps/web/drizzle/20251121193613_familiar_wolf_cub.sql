ALTER TABLE `messages` RENAME TO `events`;--> statement-breakpoint
ALTER TABLE `chats` DROP COLUMN `deleted`;--> statement-breakpoint
ALTER TABLE `mcps` DROP COLUMN `deleted`;--> statement-breakpoint
ALTER TABLE `providers` DROP COLUMN `deleted`;