CREATE TABLE `match_queue` (
	`session` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`name` text NOT NULL,
	`variant` text NOT NULL,
	`control` text NOT NULL,
	`room` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_match_queue_search` ON `match_queue` (`variant`,`control`,`room`,`expires_at`);