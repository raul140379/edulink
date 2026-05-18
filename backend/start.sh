#!/bin/sh
echo "Starting SGJE server..."
node -r ./node_modules/ts-node/register/transpile-only ./src/index.ts