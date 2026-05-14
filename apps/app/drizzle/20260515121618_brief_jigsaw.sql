CREATE TABLE `merkleTrees` (
	`accountId` text PRIMARY KEY NOT NULL,
	`tree` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`accountId` text NOT NULL,
	`clientId` text NOT NULL,
	`data` blob NOT NULL,
	`signature` text NOT NULL,
	`timestamp` text NOT NULL,
	PRIMARY KEY(`accountId`, `timestamp`)
);
--> statement-breakpoint
CREATE TABLE `metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
