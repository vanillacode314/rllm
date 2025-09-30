CREATE TABLE `mcps` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
