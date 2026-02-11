-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `messages` (
	`accountId` text NOT NULL,
	`clientId` text NOT NULL,
	`syncedAt` text NOT NULL,
	`data` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

*/