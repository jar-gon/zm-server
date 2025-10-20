import dayjs from 'dayjs';

const DATE_PATTERN = 'YYYY-MM-DD';
const DATE_TIME = 'HH-mm-ss';
const DATE_TIME_PATTERN = 'YYYY-MM-DD HH-mm-ss';

export function formatDate(date: Date | string | number, pattern = DATE_PATTERN): string {
  return dayjs(date).format(pattern);
}

export function formatDateTime(date: Date | string | number, pattern = DATE_TIME_PATTERN): string {
  return dayjs(date).format(pattern);
}

export function formatTime(date: Date | string | number, pattern = DATE_TIME): string {
  return dayjs(date).format(pattern);
}
