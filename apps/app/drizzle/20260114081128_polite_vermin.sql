PRAGMA foreign_keys = OFF;


--> statement-breakpoint
CREATE TABLE `__new_messages` (
  `accountId` text NOT NULL,
  `clientId` text NOT NULL,
  `data` text,
  `data_format` integer DEFAULT 0 NOT NULL,
  `data_proto` blob,
  `syncedAt` text NOT NULL,
  PRIMARY KEY (`accountId`, `syncedAt`),
  CONSTRAINT "data_format_check" CHECK ("__new_messages"."data_format" IN (0, 1))
);


--> statement-breakpoint
INSERT INTO
  `__new_messages` (
    "accountId",
    "clientId",
    "data",
    "data_format",
    "data_proto",
    "syncedAt"
  )
SELECT
  "accountId",
  "clientId",
  "data",
  0,
  NULL,
  "syncedAt"
FROM
  `messages`;


--> statement-breakpoint
DROP TABLE `messages`;


--> statement-breakpoint
ALTER TABLE `__new_messages`
RENAME TO `messages`;


--> statement-breakpoint
PRAGMA foreign_keys = ON;

