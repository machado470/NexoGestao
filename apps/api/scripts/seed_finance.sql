\set ON_ERROR_STOP on

-- =====================================================================
-- seed_finance.sql
-- Seed idempotente do Finance para a org "default"
--
-- O que cria:
-- - Customer teste (por email)
-- - Charge seed (por notes = 'seed:finance:v1')
-- - Payment seed (por externalRef = 'seed:finance:v1')
-- - Reconciliação: marca a Charge como PAID + paidAt quando existir Payment
--
-- Estratégia (100% robusta):
-- 1) Faz os upserts e retorna ids/paidAt
-- 2) Usa \gset pra salvar em variáveis do psql
-- 3) Faz UPDATE separado usando as variáveis (sem “CTE fantasma”)
-- =====================================================================

with org as (
  select id
  from "Organization"
  where slug = 'default'
  limit 1
),

-- 1) Customer (idempotente por email + org)
cust_pick as (
  select c.id, c."orgId"
  from "Customer" c
  where c."orgId" = (select id from org)
    and c.email = 'cliente@teste.com'
  limit 1
),
cust_ins as (
  insert into "Customer" (id, "orgId", name, phone, email, notes, active, "createdAt", "updatedAt")
  select
    gen_random_uuid(),
    (select id from org),
    'Cliente Teste',
    '5547999999999',
    'cliente@teste.com',
    'seed manual',
    true,
    now(),
    now()
  where not exists (select 1 from cust_pick)
  returning id, "orgId"
),
cust as (
  select * from cust_pick
  union all
  select * from cust_ins
),

-- 2) Charge (idempotente por (orgId, customerId, notes))
chg_pick as (
  select ch.id, ch."orgId", ch."customerId", ch."amountCents"
  from "Charge" ch
  where ch."orgId" = (select id from org)
    and ch."customerId" = (select id from cust)
    and ch.notes = 'seed:finance:v1'
  order by ch."createdAt" desc
  limit 1
),
chg_ins as (
  insert into "Charge" (
    id, "orgId", "customerId", "amountCents",
    currency, status, "dueDate", "paidAt",
    notes, "createdAt", "updatedAt"
  )
  select
    gen_random_uuid(),
    (select id from org),
    (select id from cust),
    15000,
    'BRL',
    'PENDING'::"ChargeStatus",
    now() + interval '3 days',
    null,
    'seed:finance:v1',
    now(),
    now()
  where not exists (select 1 from chg_pick)
  returning id, "orgId", "customerId", "amountCents"
),
chg as (
  select * from chg_pick
  union all
  select * from chg_ins
),

-- 3) Payment (idempotente por (orgId, externalRef))
pay_pick as (
  select p.id, p."paidAt"
  from "Payment" p
  where p."orgId" = (select id from org)
    and p."externalRef" = 'seed:finance:v1'
  order by p."createdAt" desc
  limit 1
),
pay_ins as (
  insert into "Payment" (
    id, "orgId", "chargeId", "amountCents",
    method, "paidAt", notes, "externalRef", "createdAt"
  )
  select
    gen_random_uuid(),
    (select id from org),
    (select id from chg),
    (select "amountCents" from chg),
    'PIX'::"PaymentMethod",
    now(),
    'seed payment',
    'seed:finance:v1',
    now()
  where not exists (select 1 from pay_pick)
  returning id, "paidAt"
),
pay as (
  select * from pay_pick
  union all
  select * from pay_ins
)

select
  (select id from org) as org_id,
  (select id from cust) as customer_id,
  (select id from chg) as charge_id,
  (select id from pay) as payment_id,
  (select "paidAt" from pay limit 1) as payment_paidat
\gset

-- 4) Reconciliação FORA do WITH (sem chance do Postgres “sumir” com o update)
update "Charge"
set
  status = 'PAID'::"ChargeStatus",
  "paidAt" = :'payment_paidat'::timestamptz,
  "updatedAt" = now()
where id = :'charge_id'
  and "orgId" = :'org_id'
  and notes = 'seed:finance:v1';

-- 5) Resultado final (pra você ver na hora)
select
  :'org_id' as org_id,
  :'customer_id' as customer_id,
  :'charge_id' as charge_id,
  :'payment_id' as payment_id,
  (select status from "Charge" where id = :'charge_id') as charge_status_after_reconcile,
  (select "paidAt" from "Charge" where id = :'charge_id') as charge_paidat_after_reconcile;
