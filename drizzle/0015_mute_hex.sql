CREATE TABLE `whatsappAutomationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationId` int NOT NULL,
	`organizationId` int NOT NULL,
	`triggeredBy` varchar(100),
	`recipientPhoneNumber` varchar(20) NOT NULL,
	`messageSent` text,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`whatsappMessageId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappAutomationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappAutomations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`whatsappConfigId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerType` enum('appointment_confirmed','appointment_reminder','appointment_canceled','service_order_created','service_order_completed','invoice_created','invoice_paid','custom_message') NOT NULL,
	`triggerCondition` text,
	`responseMessage` text NOT NULL,
	`isActive` boolean DEFAULT true,
	`executionCount` int DEFAULT 0,
	`lastExecutedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappAutomations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`apiKey` text NOT NULL,
	`phoneNumberId` varchar(100) NOT NULL,
	`businessAccountId` varchar(100) NOT NULL,
	`webhookUrl` text,
	`verifyToken` varchar(255),
	`isConnected` boolean DEFAULT false,
	`lastSyncedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappConfigs_id` PRIMARY KEY(`id`)
);
