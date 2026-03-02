CREATE TABLE `launches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`chargeId` int,
	`type` enum('income','expense') NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`paidDate` timestamp,
	`status` enum('pending','paid','overdue','canceled') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `launches_id` PRIMARY KEY(`id`)
);
