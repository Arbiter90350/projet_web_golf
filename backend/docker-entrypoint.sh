#!/bin/sh
set -e

# Optionally run the seed script before starting the server
if [ "$SEED_ON_START" = "1" ] || [ "$SEED_ON_START" = "true" ] || [ "$SEED_ON_START" = "TRUE" ]; then
  echo "[entrypoint] SEED_ON_START is enabled - running database seed..."
  node src/seeds/seed.js || echo "[entrypoint] Seed failed (continuing to start the app)."
else
  echo "[entrypoint] SEED_ON_START is disabled - skipping seed."
fi

# Start the application
exec npm start
