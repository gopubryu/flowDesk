export type CodeRecord = { code: string };

export function filterRecords<T extends CodeRecord>(
  rows: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    fields.some((field) =>
      String(row[field] ?? "")
        .toLowerCase()
        .includes(normalized)
    )
  );
}

export function deleteRecordByCode<T extends CodeRecord>(rows: T[], code: string): T[] {
  const normalized = code.trim().toLowerCase();
  return rows.filter((row) => row.code.trim().toLowerCase() !== normalized);
}

export function updateRecordByCode<T extends CodeRecord>(
  rows: T[],
  originalCode: string,
  replacement: T
): T[] {
  const normalized = originalCode.trim().toLowerCase();
  const index = rows.findIndex((row) => row.code.trim().toLowerCase() === normalized);
  if (index < 0) return rows;
  return rows.map((row, rowIndex) => (rowIndex === index ? replacement : row));
}
