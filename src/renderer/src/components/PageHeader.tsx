import type { ReactNode } from 'react';
import { Box, Group, Stack, Text, Title } from '@mantine/core';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  const classes = ['openflow-page-header', className].filter(Boolean).join(' ');

  return (
    <Group className={classes} justify="space-between" wrap="nowrap">
      <Group className="openflow-page-heading" wrap="nowrap">
        <Box className="openflow-page-icon" aria-hidden="true">
          {icon}
        </Box>
        <Stack className="openflow-page-copy" gap={0}>
          <Title className="openflow-page-title" order={1}>
            {title}
          </Title>
          {description && (
            <Text className="openflow-page-description" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
      </Group>
      {actions && (
        <Group className="openflow-page-actions" gap="sm" wrap="nowrap">
          {actions}
        </Group>
      )}
    </Group>
  );
}
