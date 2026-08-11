dev APP='rllm':
  #!/usr/bin/env bash
  set -euo pipefail
  if [ "{{APP}}" = "rllm" ]; then
    bunx turbo run dev --filter=rllm --filter=sync-server-go --filter=hlc --filter=merkle-tree --filter=event-logger --filter=proto --filter=ts-result-option --filter=ui --filter=mutex --filter=vector-db
  fi
push:
  jj git push && git push --tags && jj new main
