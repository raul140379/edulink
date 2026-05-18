#!/bin/sh
echo "Starting SGJE server..."
node -r ts-node/register/transpile-only src/index.ts