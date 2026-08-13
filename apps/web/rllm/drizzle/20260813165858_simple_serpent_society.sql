PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`data` text NOT NULL,
	`timestamp` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_events`("data", "timestamp", "type", "version") SELECT "data", "timestamp", "type", "version" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;