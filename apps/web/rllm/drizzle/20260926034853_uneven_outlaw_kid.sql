CREATE TABLE `chatPresets` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chats` (
	`accessCount` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`finished` integer DEFAULT 1 NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`lastAccessedAt` integer,
	`messages` text NOT NULL,
	`settings` text NOT NULL,
	`tags` text DEFAULT "[]" NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`data` text NOT NULL,
	`timestamp` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcps` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`baseUrl` text NOT NULL,
	`createdAt` text NOT NULL,
	`defaultModelIds` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`column` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`rowId` text NOT NULL,
	`table` text NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `updates_table_rowId_column_unique` ON `updates` (`table`,`rowId`,`column`);--> statement-breakpoint
CREATE TABLE `userMetadata` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
