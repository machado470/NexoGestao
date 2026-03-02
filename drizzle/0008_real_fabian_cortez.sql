CREATE TABLE `discounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`serviceTrackingId` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`amount` decimal(10,2),
	`percentage` decimal(5,2),
	`approvedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`collaboratorId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`status` enum('started','paused','completed','canceled') NOT NULL DEFAULT 'started',
	`hoursWorked` decimal(10,2),
	`hourlyRate` decimal(10,2) NOT NULL,
	`amountEarned` decimal(10,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceTracking_id` PRIMARY KEY(`id`)
);
