'use strict'

const IORedis = require('ioredis')
const { Worker } = require('bullmq')

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 1_000,
})

const worker = new Worker('automation', async (job) => {
  if (job.name !== 'stall-once') return

  if (process.send) process.send({ type: 'acquired', jobId: job.id })
  await new Promise(() => undefined)
}, {
  connection,
  lockDuration: 500,
  stalledInterval: 500,
  maxStalledCount: 1,
})

worker.on('error', (error) => {
  if (process.send) process.send({ type: 'error', message: error.message })
})
