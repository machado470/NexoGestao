#!/usr/bin/env bash
pnpm prisma generate && pnpm -r exec tsc --noEmit
