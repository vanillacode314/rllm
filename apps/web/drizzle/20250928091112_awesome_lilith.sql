CREATE TABLE `chats` (
	`createdAt` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`messages` text NOT NULL,
	`updatedAt` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
