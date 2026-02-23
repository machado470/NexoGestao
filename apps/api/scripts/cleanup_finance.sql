\set ON_ERROR_STOP on

-- =====================================================================
-- cleanup_finance.sql
-- Remove dados de DEMO/SEED do Finance, sem tocar em dados "reais".
--
-- Regras de limpeza:
-- - Payments: remove os do seed por externalRef = 'seed:finance:v1'
-- - Charges: remove as do seed por notes = 'seed:finance:v1'
-- - Dados manuais antigos:
--   - apaga PAYMENTS que apontem para charges do "cliente teste"
--   - apaga CHARGES PENDING de 15000 do "cliente teste" SEM serviceOrderId
-- - Customer: remove o cliente teste por email
--
-- Observação: a ordem respeita FKs (Payment -> Charge -> Customer).
-- =====================================================================

with org as (
  select id
  from "Organization"
  where slug = 'default'
  limit 1
),

cust as (
  select id, "orgId"
  from "Customer"
  where "orgId" = (select id from org)
    and email = 'cliente@teste.com'
  limit 1
),

-- Charges "manuais antigas" (heurística segura)
chg_manual as (
  select ch.id
  from "Charge" ch
  where ch."orgId" = (select id from org)
    and ch."customerId" = (select id from cust)
    and ch."amountCents" = 15000
    and ch.status = 'PENDING'::"ChargeStatus"
    and ch."serviceOrderId" is null
),

-- 1) Payments do seed (externalRef)
del_pay_seed as (
  delete from "Payment"
  where "orgId" = (select id from org)
    and "externalRef" = 'seed:finance:v1'
  returning id
),

-- 2) Payments manuais: qualquer Payment que referencia os charges manuais
del_pay_manual as (
  delete from "Payment"
  where "orgId" = (select id from org)
    and "chargeId" in (select id from chg_manual)
  returning id
),

-- 3) Charges do seed (notes)
del_chg_seed as (
  delete from "Charge"
  where "orgId" = (select id from org)
    and notes = 'seed:finance:v1'
  returning id
),

-- 4) Charges manuais
del_chg_manual as (
  delete from "Charge"
  where id in (select id from chg_manual)
  returning id
)

-- 5) Customer teste
delete from "Customer"
where "orgId" = (select id from org)
  and email = 'cliente@teste.com';
