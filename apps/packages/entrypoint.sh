#!/bin/sh

# 1. Apply database migrations
echo "Applying database migrations..."
npx prisma migrate deploy --config prisma/prisma.config.ts

# 2. Seed the database
echo "Seeding database..."
npx prisma db seed --config prisma/prisma.config.ts