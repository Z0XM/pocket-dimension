#!/bin/bash
# Wrapper script to run turbo and remove workspace prefix from logs
# Usage: ./scripts/turbo-no-prefix.sh run dev

# Run turbo with all arguments and strip the workspace prefix pattern
# Pattern matches: @workspace-name/package-name:task:
# Only strips lines that match the pattern, leaves other output intact
# Use PIPESTATUS to preserve turbo's exit code
bunx turbo "$@" 2>&1 | sed -E 's/^@[^:]+:[^:]+: //'
exit ${PIPESTATUS[0]}
