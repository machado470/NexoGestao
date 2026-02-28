import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { JobsModule } from './jobs.module'
import { EnforcementJob } from './governance/enforcement.job'
import { OperationalStateJob } from './people/operational-state.job'

async function run() {
  console.log('⚙️  JOBS — bootstrap iniciado')

  const app = await NestFactory.createApplicationContext(JobsModule, {
    logger: ['log', 'error', 'warn'],
  })

  try {
    const operationalStateJob = app.get(OperationalStateJob)
    const enforcementJob = app.get(EnforcementJob)

    console.log('▶️  OperationalStateJob iniciado')
    await operationalStateJob.run()
    console.log('✅ OperationalStateJob finalizado')

    console.log('▶️  EnforcementJob iniciado')
    await enforcementJob.run()
    console.log('✅ EnforcementJob finalizado')

    console.log('🎉 JOBS finalizados com sucesso')

    await app.close()
    process.exit(0)
  } catch (err) {
    console.error('🔥 ERRO NA EXECUÇÃO DOS JOBS', err)
    await app.close()
    process.exit(1)
  }
}

run()
