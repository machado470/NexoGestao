// Audit probes against compiled services; all providers/persistence are stubs.
// Assertions record current defects, not the desired long-term behavior.
const path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..');
process.env.NODE_ENV='test';
const {AuthService}=require(path.join(root,'apps/api/dist/auth/auth.service'));
const {BillingService}=require(path.join(root,'apps/api/dist/billing/billing.service'));
const {PaymentsService}=require(path.join(root,'apps/api/dist/payments/payments.service'));
const {CommercialPolicyService}=require(path.join(root,'apps/api/dist/common/commercial/commercial-policy.service'));
const {TenantOperationsService}=require(path.join(root,'apps/api/dist/common/tenant-ops/tenant-ops.service'));
const {QuotasService}=require(path.join(root,'apps/api/dist/quotas/quotas.service'));
const config={get:key=>key==='NODE_ENV'?'test':key==='STRIPE_WEBHOOK_SECRET'?'audit-placeholder':undefined};
const observations=[];
async function observe(id,fn){observations.push({id,...await fn()});}
(async()=>{
 await observe('AUTH_INPUT',async()=>{
  const service=new AuthService({}, {}, {},config);
  await assert.rejects(service.register({orgName:123,adminName:'Audit',email:'audit@test.invalid',password:'AuditOnly123!'}),TypeError);
  return {observed:'non-string organization name throws TypeError before validation',confirmed:true};
 });
 await observe('EMAIL_RESULT',async()=>{
  let updated=0;
  const user={id:'audit-user',orgId:'audit-org',email:'audit@test.invalid',role:'ADMIN',person:{id:'audit-person'}};
  const db={user:{findUnique:async()=>null,create:async()=>user,update:async()=>{updated++;return user}},organization:{findUnique:async()=>null,create:async()=>({id:'audit-org'})}};
  db.$transaction=fn=>fn(db);
  const service=new AuthService(db,{sign:()=> 'audit-placeholder'}, {},config);
  service.resend={emails:{send:async()=>({data:null,error:{name:'validation_error',message:'Synthetic rejection'}})}};
  const registered=await service.register({orgName:'Audit',adminName:'Audit',email:user.email,password:'AuditOnly123!'});
  assert.equal(registered.emailVerificationStatus,'sent');
  db.user.findUnique=async()=>user;
  const reset=await service.forgotPassword(user.email);assert.equal(reset.success,true);
  return {observed:'registration reports sent and password-reset reports success after resolved provider error',verificationStatus:registered.emailVerificationStatus,resetSuccess:reset.success,tokensPersisted:updated,confirmed:true};
 });
 await observe('AUTH_ENUMERATION',async()=>{
  const db={user:{findUnique:async({where})=>where.email==='known@test.invalid'?{id:'known'}:null}};
  const service=new AuthService(db,{}, {},config);
  const missing=await service.forgotPassword('absent@test.invalid');
  let knownStatus;try{await service.forgotPassword('known@test.invalid')}catch(e){knownStatus=e.getStatus()}
  assert.equal(missing.success,true);assert.equal(knownStatus,503);
  return {observed:'without email provider, known and unknown accounts produce different outcomes',unknownSuccess:true,knownStatus,confirmed:true};
 });
 let current={id:'audit-sub',orgId:'audit-org',planId:'audit-plan',status:'ACTIVE',billingExternalRef:'sub_audit',currentPeriodStart:new Date(),currentPeriodEnd:new Date()};
 const db={billingEvent:{findUnique:async()=>null,create:async()=>({id:'audit-event'})},plan:{findUnique:async()=>({id:'audit-plan',priceCents:9900})},subscription:{findFirst:async()=>current,upsert:async args=>(current={...current,...args.create}),update:async args=>(current={...current,...args.data})}};
 db.$transaction=fn=>fn(db);
 const billing=new BillingService(db,config,{});
 billing.stripe={webhooks:{constructEvent:body=>JSON.parse(body)}};
 const deliver=event=>billing.handleWebhook(Buffer.from(JSON.stringify(event)),'synthetic-signature');
 await observe('BILLING_UNPAID',async()=>{
  await deliver({id:'evt_unpaid',created:100,type:'checkout.session.completed',data:{object:{mode:'subscription',payment_status:'unpaid',metadata:{orgId:'audit-org',planName:'STARTER'},subscription:'sub_audit'}}});
  assert.equal(current.status,'ACTIVE');return {observed:'unpaid subscription checkout activates local plan',status:current.status,confirmed:true};
 });
 await observe('BILLING_ORDER',async()=>{
  await deliver({id:'evt_deleted',created:300,type:'customer.subscription.deleted',data:{object:{id:'sub_audit',status:'canceled',items:{data:[]},canceled_at:300}}});
  assert.equal(current.status,'CANCELED');
  await deliver({id:'evt_older_paid',created:200,type:'invoice.paid',data:{object:{subscription:'sub_audit',amount_paid:9900,period_start:100,period_end:200}}});
  assert.equal(current.status,'ACTIVE');return {observed:'older paid invoice reactivates subscription after newer cancellation',finalStatus:current.status,confirmed:true};
 });
 await observe('PAYMENT_REFUND',async()=>{
  let writes=0;
  const service=new PaymentsService(config,{}, {payCharge:async()=>{writes++}});
  service.stripe={webhooks:{constructEvent:()=>({id:'evt_refund',type:'charge.refunded',data:{object:{metadata:{orgId:'audit-org',chargeId:'audit-charge'},amount_refunded:1000}}})}};
  const result=await service.handleWebhook(Buffer.from('{}'),'synthetic-signature');
  assert.deepEqual(result,{received:true});assert.equal(writes,0);
  return {observed:'refund event is acknowledged without a local refund/reconciliation handler',confirmed:true};
 });
 const subscription={status:'ACTIVE',currentPeriodEnd:new Date(Date.now()+86400000),plan:{name:'FREE',limitsJson:{message_sends:300},featuresJson:{}}};
 const commercialDb={subscription:{findUnique:async()=>subscription},tenantFeatureOverride:{findMany:async()=>[]}};
 await observe('COMMERCIAL_MEMORY',async()=>{
  const first=new TenantOperationsService(),second=new TenantOperationsService();first.increment('audit-org','whatsapp_queued',300);
  const a=await new CommercialPolicyService(commercialDb,first).enforceMeter('audit-org','message_sends');
  const b=await new CommercialPolicyService(commercialDb,second).enforceMeter('audit-org','message_sends');
  assert.equal(a.allowed,false);assert.equal(b.allowed,true);
  return {observed:'commercial meter exhausted in one instance is available in another',firstAllowed:a.allowed,secondAllowed:b.allowed,confirmed:true};
 });
 await observe('COMMERCIAL_SUSPENDED',async()=>{
  subscription.status='SUSPENDED';subscription.plan.name='PRO';
  const policy=new CommercialPolicyService(commercialDb,new TenantOperationsService());
  const feature=await policy.canUseFeature('audit-org','advanced_automation');
  const meter=await policy.enforceMeter('audit-org','message_sends');
  const quota=await new QuotasService(commercialDb).getOrgPlan('audit-org');
  assert.equal(feature.allowed,false);assert.equal(meter.allowed,true);assert.equal(quota,'PRO');
  return {observed:'suspended subscription blocks feature but permits meter and retains paid resource quotas',featureAllowed:false,meterAllowed:true,quotaPlan:quota,confirmed:true};
 });
 await observe('SSE_REVOCATION',async()=>{
  const {EventEmitter}=require('node:events');
  const {NotificationsController}=require(path.join(root,'apps/api/dist/notifications/notifications.controller'));
  const timers=[],originalInterval=global.setInterval,originalTimeout=global.setTimeout;
  let ended=false,queried;
  const request=new EventEmitter();request.user={orgId:'audit-org',sub:'audit-user',exp:Math.floor(Date.now()/1000)+3600};request.headers={};
  const response=new EventEmitter();Object.assign(response,{set:()=>{},flushHeaders:()=>{},write:()=>true,end:()=>{ended=true},writableEnded:false,destroyed:false});
  const controller=new NotificationsController({}, {user:{count:async args=>{queried=args.where;return 1}}}, {add:()=>({remove:()=>{},finishReplay:async()=>true})});
  try{
   global.setInterval=callback=>{timers.push(callback);return {}};global.setTimeout=()=>({});
   await controller.stream(request,response);await timers[1]();
   assert.deepEqual(queried,{id:'audit-user',orgId:'audit-org',active:true});assert.equal(ended,false);
  }finally{global.setInterval=originalInterval;global.setTimeout=originalTimeout;}
  return {observed:'open stream revalidation checks active user only; active account with changed sessionVersion, role or inactive person remains connected until token expiry',streamClosed:false,confirmed:true};
 });
 console.log(JSON.stringify({method:'isolated executable service probes, synthetic persistence and provider responses; no external calls',observations,pass:true},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
