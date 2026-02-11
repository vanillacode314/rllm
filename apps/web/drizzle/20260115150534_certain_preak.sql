CREATE TABLE `chats` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`tags` text DEFAULT "[]" NOT NULL,
	`finished` integer DEFAULT 1 NOT NULL,
	`messages` text NOT NULL,
	`settings` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`timestamp` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`version` text
);
--> statement-breakpoint
CREATE TABLE `mcps` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`baseUrl` text NOT NULL,
	`token` text NOT NULL,
	`defaultModelIds` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userMetadata` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` text NOT NULL
);
