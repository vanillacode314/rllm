export function formatAsKeyValuePair(
  obj: object,
  filterValues?: (value: unknown) => boolean
): string {
  let result = '';
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && (!filterValues || filterValues(obj[key as keyof typeof obj]))) {
      result += `${key}: ${obj[key as keyof typeof obj]}\n`;
    }
  }
  return result;
}
