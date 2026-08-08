export function createDatabaseConstants<const T extends string>(name: T) {
  return [`${name}.db`, name] as const;
}
