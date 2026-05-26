#!/bin/sh

set -eu

mkdir -p /app/log /app/ailog

echo "Starting multilingual server"
yarn run start