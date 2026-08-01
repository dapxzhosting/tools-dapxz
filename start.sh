#!/bin/sh
set -e

node /opt/bgutil-provider/server/build/main.js &

sleep 2

exec node server.js