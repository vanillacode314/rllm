dev APP='web':
  #!/usr/bin/env bash
  set -euo pipefail
  if [ "{{APP}}" = "web" ]; then
    bunx turbo run dev --filter=web --filter=app --filter=hlc --filter=merkle-tree --filter=event-logger --filter=proto
  fi
