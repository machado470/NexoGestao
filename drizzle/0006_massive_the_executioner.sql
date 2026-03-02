CREATE TABLE `contactHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`contactType` enum('phone','email','whatsapp','in_person','other') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`description` text,
	`notes` text,
	`contactedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contactHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int NOT NULL,
	`messageId` varchar(255),
	`direction` enum('inbound','outbound') NOT NULL,
	`content` text NOT NULL,
	`status` enum('pending','sent','delivered','read','failed') NOT NULL DEFAULT 'pending',
	`senderNumber` varchar(20),
	`receiverNumber` varchar(20),
	`mediaUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsappMessages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `street` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `number` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `complement` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `zipCode` varchar(10);--> statement-breakpoint
ALTER TABLE `customers` ADD `city` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `state` varchar(2);--> statement-breakpoint
ALTER TABLE `customers` ADD `country` varchar(100) DEFAULT 'Brasil';--> statement-breakpoint
ALTER TABLE `customers` ADD `whatsappNumber` varchar(20);