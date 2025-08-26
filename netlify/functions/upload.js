// netlify/functions/upload.js
// Node 18+: global fetch / FormData / Blob available

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

export async function handler(event) {
  try {
    // --- CORS preflight -------------------------------------------------------
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS };
    }

    // --- Warmup ping (best-effort, fast path) --------------------------------
    if (event.httpMethod === 'HEAD' && event.queryStringParameters?.warm === '1') {
      return { statusCode: 204, headers: CORS_HEADERS };
    }

    // --- Only POST allowed for upload ----------------------------------------
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    // --- Parse body -----------------------------------------------------------
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    // ★ accept score (frozen at click) in addition to your existing fields
    const { image, name, description, attributes, score } = payload; // ★

    // Expect a data URL (we snapshot to PNG in the frontend)
    if (!image || !/^data:image\//i.test(image)) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing or invalid image data (must be data:image/*;base64,...)' }),
      };
    }

    if (!process.env.PINATA_JWT) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'PINATA_JWT not configured on Netlify' }),
      };
    }

    // --- Decode data URL -> Buffer -------------------------------------------
    // data:[mime];base64,<payload>
    const header = image.substring(0, image.indexOf(',')) || '';
    const base64 = image.split(',')[1] || '';
    const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/i);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/png';

    // File extension guess (only for nicer filenames on Pinata)
    const ext = mimeType === 'image/jpeg' ? 'jpg'
              : mimeType === 'image/svg+xml' ? 'svg'
              : mimeType === 'image/webp' ? 'webp'
              : 'png';

    let bytes;
    try {
      bytes = Buffer.from(base64, 'base64');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid base64 image payload' }),
      };
    }

    // --- 1) Pin the image to Pinata ------------------------------------------
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), `puzzle.${ext}`);

    const fileRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
      body: form,
    });

    if (!fileRes.ok) {
      const txt = await safeText(fileRes);
      throw new Error(`pinFileToIPFS failed: ${fileRes.status} ${txt}`);
    }

    const fileJson = await fileRes.json();
    const imageCid = fileJson.IpfsHash;
    const imageUri = `ipfs://${imageCid}`;
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // --- 2) Build metadata JSON ----------------------------------------------
    const safeAttributes = Array.isArray(attributes) ? attributes.slice() : [];

    // ★ Merge canonical traits from score (Rank, Completion, Time, Tiles, Grid)
    if (score && typeof score === 'object') { // ★
      const { rank, percent, correct, total, timeSec, elapsedSec, completedAtSec } = score;
      upsertTrait(safeAttributes, 'Rank', rank || 'Bronze');
      if (Number.isFinite(percent)) upsertTrait(safeAttributes, 'Completion (%)', Number(percent));
      if (Number.isFinite(timeSec)) upsertTrait(safeAttributes, 'Time (s)', Number(timeSec));
      if (Number.isFinite(correct) && Number.isFinite(total)) {
        upsertTrait(safeAttributes, 'Tiles Correct', `${correct}/${total}`);
        const n = Math.sqrt(total);
        if (Number.isFinite(n)) upsertTrait(safeAttributes, 'Grid', `${n}x${n}`);
      }
      upsertTrait(safeAttributes, 'Snapshot', 'Locked-at-click');
    }

    // Guarantee a Rank trait exists (fallback)
    if (!safeAttributes.some(a => (a?.trait_type || a?.traitType) === 'Rank')) {
      safeAttributes.push({ trait_type: 'Rank', value: 'Bronze' });
    }

    const metadata = {
      name: name || 'Moncock Puzzle',
      description: description || 'Snapshot of your puzzle from Moncock Puzzle.',
      image: imageUri,
      attributes: normalizeTraits(safeAttributes), // ★ normalize trait keys
      // ★ keep raw score for explorers (optional; harmless if undefined)
      properties: score ? { score } : undefined,
    };

    // --- 3) Pin metadata JSON to Pinata --------------------------------------
    const metaRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!metaRes.ok) {
      const txt = await safeText(metaRes);
      throw new Error(`pinJSONToIPFS failed: ${metaRes.status} ${txt}`);
    }

    const metaJson = await metaRes.json();
    const metaCid = metaJson.IpfsHash;
    const metaUri = `ipfs://${metaCid}`;
    const metaGateway = `https://gateway.pinata.cloud/ipfs/${metaCid}`;

    // --- 4) Done --------------------------------------------------------------
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        imageGateway,   // https://gateway.pinata.cloud/ipfs/<imageCID>
        uri: metaUri,   // ipfs://<metadataCID>
        uriGateway: metaGateway, // https://gateway.pinata.cloud/ipfs/<metadataCID>
        metadata        // ★ echo back so you can show metadata in UI
      }),
    };
  } catch (err) {
    console.error('[upload] error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal Error' }),
    };
  }
}

// Small helper to read response text safely
async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

// ★ Helpers to manage traits cleanly
function upsertTrait(arr, traitType, value) { // ★
  const i = arr.findIndex(a => (a?.trait_type || a?.traitType) === traitType);
  const entry = { trait_type: traitType, value };
  if (i >= 0) arr[i] = entry; else arr.push(entry);
  return arr;
}
function normalizeTraits(arr) { // ★
  return arr.map(a => {
    if (a && !a.trait_type && a.traitType) {
      const { traitType, ...rest } = a;
      return { trait_type: traitType, ...rest };
    }
    return a;
  });
}
