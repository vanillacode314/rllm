ALTER TABLE `chats` ADD `access_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chats` ADD `last_accessed_at` integer;