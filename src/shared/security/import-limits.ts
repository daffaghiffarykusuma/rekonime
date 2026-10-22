export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_STRING_LENGTH = 2048;
export const MAX_XML_FIELD_LENGTH = 8192;
export const MAX_PROFILE_ITEMS = 5000;
export const MAX_SNAPSHOT_TAGS = 128;

export const isBoundedImportText = (text: unknown): text is string => (
  typeof text === 'string' && text.length <= MAX_IMPORT_BYTES &&
  new TextEncoder().encode(text).byteLength <= MAX_IMPORT_BYTES
);

export const readImportText = async (file: { size?: number; text(): Promise<string> }) => {
  if (file.size !== undefined && (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_IMPORT_BYTES)) {
    throw new Error('This file is too large. Choose an export no larger than 10 MiB.');
  }
  const text = await file.text();
  if (!isBoundedImportText(text)) {
    throw new Error('This file is too large. Choose an export no larger than 10 MiB.');
  }
  return text;
};
