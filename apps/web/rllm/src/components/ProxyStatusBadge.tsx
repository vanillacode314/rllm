import { Badge, type BadgeProps } from 'ui/badge';

import type { TProxyHealthStatus } from '~/lib/proxy';

const STATUS_LABELS: Record<TProxyHealthStatus, string> = {
  failed: 'Not working',
  passing: 'Working',
  unset: 'Not configured',
  untested: 'Untested'
};

const STATUS_VARIANTS: Record<TProxyHealthStatus, BadgeProps['variant']> = {
  failed: 'error',
  passing: 'success',
  unset: 'secondary',
  untested: 'secondary'
};

function ProxyStatusBadge(props: { status: TProxyHealthStatus }) {
  return (
    <Badge round variant={STATUS_VARIANTS[props.status]}>
      {STATUS_LABELS[props.status]}
    </Badge>
  );
}

export { ProxyStatusBadge };
export default ProxyStatusBadge;
