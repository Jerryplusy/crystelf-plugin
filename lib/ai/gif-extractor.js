export async function extractGifFrames(gifUrl) {
  try {
    const { default: sharp } = await import('sharp');
    const response = await fetch(gifUrl);
    if (!response.ok) {
      logger.error(`[crystelf-ai] gif fetch failed status=${response.status} url=${gifUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer, { animated: true }).metadata();
    const totalPages = metadata.pages || 1;

    if (totalPages === 1) {
      const frame = await sharp(buffer, { animated: false, page: 0 }).png().toBuffer();
      return { frames: [`data:image/png;base64,${frame.toString('base64')}`], buffer };
    }

    const indexes = [0, Math.floor(totalPages / 2), totalPages - 1].filter(
      (value, index, array) => array.indexOf(value) === index
    );
    const frames = [];
    for (const page of indexes) {
      const frame = await sharp(buffer, { animated: false, page }).png().toBuffer();
      frames.push(`data:image/png;base64,${frame.toString('base64')}`);
    }

    logger.info(
      `[crystelf-ai] gif extracted frames=${frames.length} total=${totalPages} url=${gifUrl}`
    );
    return { frames, buffer };
  } catch (error) {
    logger.error(`[crystelf-ai] gif extract failed: ${error.message}`);
    return null;
  }
}

export async function isGifUrl(url) {
  if (String(url || '').toLowerCase().includes('.gif')) {
    return true;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://qq.com/',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('image/gif');
  } catch {
    return false;
  }
}
