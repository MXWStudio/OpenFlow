import { Badge, Tooltip } from '@mantine/core';
import type { ValidationResult } from './appState';

export function StatusBadge({ result }: { result: ValidationResult }) {
  const config =
    result.status === 'valid'
      ? { color: 'teal', label: '已通过' }
      : result.status === 'mismatch'
        ? { color: 'yellow', label: '尺寸不符' }
        : result.status === 'missing'
          ? { color: 'gray', label: '暂无素材' }
          : { color: 'red', label: '读取失败' };

  const badge = (
    <Badge
      color={config.color}
      variant="light"
      radius="sm"
      styles={{
        root: {
          minWidth: 78,
          justifyContent: 'center',
          fontWeight: 800,
          letterSpacing: 0.2,
        },
      }}
    >
      {config.label}
    </Badge>
  );

  if (!result.error) return badge;

  return (
    <Tooltip label={result.error} multiline maw={320}>
      <span>{badge}</span>
    </Tooltip>
  );
}
