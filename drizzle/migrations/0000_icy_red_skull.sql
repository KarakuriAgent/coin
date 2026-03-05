CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`username` text,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_discord_id_unique` ON `accounts` (`discord_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
