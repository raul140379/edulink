#!/bin/sh
echo "=== INICIANDO SERVIDOR SGJE ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "Ejecutando ts-node..."
./node_modules/.bin/ts-node --transpile-only src/index.ts
echo "=== SERVIDOR TERMINADO ==="