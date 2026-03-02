CREATE TABLE `governance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`customerId` int,
	`appointmentId` int,
	`serviceOrderId` int,
	`chargeId` int,
	`riskScore` int NOT NULL DEFAULT 0,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`complianceStatus` enum('compliant','warning','non_compliant') NOT NULL DEFAULT 'compliant',
	`issues` text,
	`recommendations` text,
	`lastEvaluated` timestamp NOT NULL DEFAULT (now()),
	`evaluatedBy` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governance_id` PRIMARY KEY(`id`)
);
