CREATE TABLE `updates` (
	`column` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`rowId` text NOT NULL,
	`table` text NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `updates_table_rowId_column_unique` ON `updates` (`table`,`rowId`,`column`);