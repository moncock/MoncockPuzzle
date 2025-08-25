// netlify/functions/upload.js
// Node 18+ runtime: built-in fetch, FormData, Blob, Buffer available

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS, HEAD',
  'access-control-allow-headers': 'content-type, authorization',
  'content-type': 'application/json'
};

export async function handler(event) {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    // Warmup ping for cold starts
    if (event.httpMethod === 'HEAD' && event.queryStringParameters?.warm === '1') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    // ---- Parse input ----
    const body = JSON.parse(event.body || '{}');
    const { image, name, description, attributes } = body;

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'Missing or invalid "image" data URL' })
      };
    }

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Server not configured: PINATA_JWT is missing' })
      };
    }

    // ---- Decode base64 image (usually PNG from canvas) ----
    const base64 = image.split(',')[1];
    const bytes = Buffer.from(base64, 'base64');

    // ---- 1) Upload image to Pinata ----
    const formImg = new FormData();
    // Use PNG as default filename; Pinata looks at the content, not extension
    formImg.append('file', new Blob([bytes], { type: 'image/png' }), 'puzzle.png');

    const upImage = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: formImg
    });

    if (!upImage.ok) {
      const txt = await safeText(upImage);
      return { statusCode: upImage.status, headers: CORS, body: JSON.stringify({ error: txt }) };
    }

    const imageResp = await upImage.json();
    const imageCid = imageResp.IpfsHash;
    const imageUri = `ipfs://${imageCid}`;
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // ---- 2) Build ERC-721 metadata JSON on the server ----
    const metadata = {
      name: name || 'Moncock Puzzle',
      description: description || 'Snapshot of your puzzle from Moncock Puzzle.',
      image: imageUri,
      attributes: Array.isArray(attributes) ? attributes : []
    };

    // ---- 3) Upload metadata JSON to Pinata ----
    const formMeta = new FormData();
    formMeta.append(
      'file',
      new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }),
      'metadata.json'
    );

    const upMeta = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: formMeta
    });

    if (!upMeta.ok) {
      const txt = await safeText(upMeta);
      return { statusCode: upMeta.status, headers: CORS, body: JSON.stringify({ error: txt }) };
    }

    const metaResp = await upMeta.json();
    const metaCid = metaResp.IpfsHash;
    const metaUri = `ipfs://${metaCid}`;
    const uriGateway = `https://gateway.pinata.cloud/ipfs/${metaCid}`;

    // ---- 4) Return both links to the client ----
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        imageGateway, // HTTP link to image (for preview/debug)
        uri: metaUri, // ipfs:// URL to metadata (some apps may use it)
        uriGateway    // HTTP link to metadata → MINT WITH THIS
      })
    };

  } catch (err) {
    console.error('[upload] error', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err?.message || 'Internal Error' })
    };
  }
}

// Small helper to safely read error text
async function safeText(res) {
  try { return await res.text(); } catch { return res.statusText || 'Upload failed'; }
}
