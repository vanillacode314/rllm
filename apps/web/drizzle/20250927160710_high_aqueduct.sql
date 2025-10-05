CREATE TABLE `messages` (
	`timestamp` text PRIMARY KEY NOT NULL,
	`user_intent` text NOT NULL,
	`meta` text NOT NULL
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
	`updatedAt` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
