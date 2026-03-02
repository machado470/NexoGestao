-- Adicionar soft delete a todas as tabelas principais
ALTER TABLE customers ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE appointments ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE serviceOrders ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE charges ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE people ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE launches ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE invoices ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE expenses ADD COLUMN deletedAt TIMESTAMP NULL;

-- Criar índices para soft delete (melhorar queries que filtram deletedAt IS NULL)
CREATE INDEX idx_customers_deletedAt ON customers(deletedAt);
CREATE INDEX idx_appointments_deletedAt ON appointments(deletedAt);
CREATE INDEX idx_serviceOrders_deletedAt ON serviceOrders(deletedAt);
CREATE INDEX idx_charges_deletedAt ON charges(deletedAt);
CREATE INDEX idx_people_deletedAt ON people(deletedAt);
CREATE INDEX idx_launches_deletedAt ON launches(deletedAt);
CREATE INDEX idx_invoices_deletedAt ON invoices(deletedAt);
CREATE INDEX idx_expenses_deletedAt ON expenses(deletedAt);

-- Criar tabela de auditoria para versionamento
CREATE TABLE IF NOT EXISTS auditLogs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entityType VARCHAR(50) NOT NULL,
  entityId INT NOT NULL,
  action VARCHAR(20) NOT NULL,
  userId INT NOT NULL,
  changes JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  organizationId INT NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (organizationId) REFERENCES organizations(id),
  INDEX idx_auditLogs_entity (entityType, entityId),
  INDEX idx_auditLogs_user (userId),
  INDEX idx_auditLogs_org (organizationId),
  INDEX idx_auditLogs_createdAt (createdAt)
);

-- Criar índices de performance adicionais
CREATE INDEX idx_customers_orgId_deletedAt ON customers(organizationId, deletedAt);
CREATE INDEX idx_appointments_orgId_deletedAt ON appointments(organizationId, deletedAt);
CREATE INDEX idx_appointments_customerId ON appointments(customerId);
CREATE INDEX idx_charges_customerId ON charges(customerId);
CREATE INDEX idx_charges_status ON charges(status);
CREATE INDEX idx_serviceOrders_customerId ON serviceOrders(customerId);
CREATE INDEX idx_serviceOrders_status ON serviceOrders(status);
