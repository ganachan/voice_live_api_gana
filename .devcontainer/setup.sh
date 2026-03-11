#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

# Build rt-client tgz from source if not present
if [ ! -f rt-client-0.5.2.tgz ]; then
  echo "==> Building rt-client-0.5.2.tgz from source …"
  tmpdir=$(mktemp -d)
  git clone --quiet https://github.com/yulin-li/aoai-realtime-audio-sdk.git "$tmpdir/sdk"
  pushd "$tmpdir/sdk" > /dev/null
  git checkout --quiet 580de56afdeabc5744a1f30b5ae9e924f60eae23
  cd javascript/standalone
  npm install --ignore-scripts > /dev/null 2>&1
  npm run build > /dev/null 2>&1
  npm pack > /dev/null 2>&1
  popd > /dev/null
  cp "$tmpdir/sdk/javascript/standalone/rt-client-0.5.2.tgz" .
  rm -rf "$tmpdir"
  echo "==> rt-client-0.5.2.tgz ready"
fi

npm install
pip install aiohttp azure-identity azure-ai-agents
