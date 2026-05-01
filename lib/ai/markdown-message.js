export const MARKDOWN_OPEN_TAG = '<MARKDOWN>';
export const MARKDOWN_CLOSE_TAG = '</MARKDOWN>';

export function splitOutgoingUnits(text) {
  const normalized = String(text || '').replace(/\r/g, '');
  const result = [];
  let buffer = '';
  let insideMarkdown = false;

  for (let index = 0; index < normalized.length;) {
    if (!insideMarkdown && normalized.startsWith(MARKDOWN_OPEN_TAG, index)) {
      if (buffer.trim()) {
        result.push(buffer.trim());
      }
      buffer = MARKDOWN_OPEN_TAG;
      insideMarkdown = true;
      index += MARKDOWN_OPEN_TAG.length;
      continue;
    }

    if (insideMarkdown && normalized.startsWith(MARKDOWN_CLOSE_TAG, index)) {
      buffer += MARKDOWN_CLOSE_TAG;
      if (buffer.trim()) {
        result.push(buffer.trim());
      }
      buffer = '';
      insideMarkdown = false;
      index += MARKDOWN_CLOSE_TAG.length;
      continue;
    }

    const char = normalized[index];
    if (!insideMarkdown && char === '\n') {
      if (buffer.trim()) {
        result.push(buffer.trim());
      }
      buffer = '';
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  if (buffer.trim()) {
    result.push(buffer.trim());
  }

  return result;
}

export function extractStandaloneMarkdownBlock(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith(MARKDOWN_OPEN_TAG) || !trimmed.endsWith(MARKDOWN_CLOSE_TAG)) {
    return null;
  }

  const inner = trimmed.slice(
    MARKDOWN_OPEN_TAG.length,
    trimmed.length - MARKDOWN_CLOSE_TAG.length
  );
  return inner.trim() || null;
}

export function summarizeMarkdown(markdown) {
  const lines = String(markdown || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, '').trim().slice(0, 40);
  }

  const firstLine = lines.find((line) => !line.startsWith('```'));
  if (!firstLine) {
    return 'Markdown';
  }

  return firstLine.replace(/^[>*\-\d.\s`]+/u, '').slice(0, 40).trim() || 'Markdown';
}
