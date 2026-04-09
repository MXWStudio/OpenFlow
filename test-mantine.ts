import { NotificationData } from '@mantine/notifications';
const data: NotificationData = {
  message: 'test',
  withCloseButton: true,
  // let's see if withProgressBar exists by intentionally putting it and checking tsc
  withProgressBar: true,
};
console.log(data);
