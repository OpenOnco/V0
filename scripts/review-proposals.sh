#!/bin/bash
# Review proposals - runs standalone Node server
cd "$(dirname "$0")/.." || exit 1
node scripts/review-proposals.js
