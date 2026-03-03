CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`icon` varchar(50),
	`color` varchar(20) DEFAULT 'orange-500',
	`ctaText` varchar(100) NOT NULL,
	`ctaLink` text,
	`priority` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`startDate` timestamp,
	`endDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
