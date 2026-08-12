import { Badge, Tooltip } from '@mantine/core';
import type { ValidationResult } from './appState';
import type { ValidationRowKind } from './validationPresentation';

export function StatusBadge({
  result,
  muted = false,
  kind,
}: {
  result: ValidationResult;
  muted?: boolean;
  kind?: ValidationRowKind;
}) {
  const config =
    kind === 'extra'
      ? { color: 'blue', label: '非需求' }
      : result.status === 'valid'
      ? { color: 'teal', label: '已通过' }
      : result.status === 'mismatch'
        ? { color: 'yellow', label: '尺寸错误' }
        : result.status === 'missing'
          ? result.missingKind === 'empty_folder'
            ? { color: 'red', label: '缺失文件' }
            : { color: 'red', label: `缺 ${result.missingCount || 1} 张` }
          : { color: 'red', label: '读取失败' };

  const isMutedValid = muted && result.status === 'valid';
  const badge = (
    <Badge
      color={isMutedValid ? 'gray' : config.color}
      variant={isMutedValid ? 'outline' : 'light'}
      radius="sm"
      styles={{
        root: {
          minWidth: 78,
          justifyContent: 'center',
          fontWeight: 800,
          letterSpacing: 0.2,
          opacity: isMutedValid ? 0.72 : 1,
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
