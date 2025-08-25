// netlify/functions/upload.js
// Uses Node 18 built-ins: fetch, FormData, Blob

const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export async function handler(event) {
  try {
    // (unchanged) warmup ping for your frontend
    if (event.httpMethod === 'HEAD' && event.queryStringParameters?.warm === '1') {
      return { statusCode: 204 };
    }

    // (unchanged) allow only POST
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // (CHANGED) accept optional name/description/attributes for metadata
    const { image, name, description, attributes } = JSON.parse(event.body || '{}');
    if (!image || !image.startsWith('data:image/')) {
      return json(400, { error: 'Missing or invalid image data (expected data:image/... base64 URL)' });
    }

    // (CHANGED) ensure Pinata auth is present
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return json(500, { error: 'Server misconfigured: PINATA_JWT is not set.' });
    }

    // (unchanged) decode data URL -> bytes
    const base64 = image.split(',')[1];
    const bytes = Buffer.from(base64, 'base64');

    // (CHANGED) 1) upload the image to Pinata
    const fileForm = new FormData();
    fileForm.append('file', new Blob([bytes], { type: 'image/png' }), 'puzzle.png');

    // Optional: Pinata metadata/options (uncomment if you want)
    // fileForm.append('pinataMetadata', new Blob([JSON.stringify({ name: "moncock-puzzle-image" })], { type: 'application/json' }));
    // fileForm.append('pinataOptions',  new Blob([JSON.stringify({ cidVersion: 1 })], { type: 'application/json' }));

    const fileRes = await fetch(PINATA_FILE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: fileForm,
    });

    if (!fileRes.ok) {
      const errText = await safeText(fileRes);
      return json(fileRes.status, { error: `Image upload failed: ${errText || fileRes.statusText}` });
    }

    const fileJson = await fileRes.json();
    const imageCid = fileJson?.IpfsHash;
    if (!imageCid) return json(500, { error: 'Pinata image response missing IpfsHash' });

    const imageIpfs = `ipfs://${imageCid}`;
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // (CHANGED) 2) build metadata JSON
    const metadata = {
      name: name || 'Moncock Puzzle',
      description: description || 'Snapshot of your puzzle from Moncock Puzzle.',
      image: imageIpfs, // ipfs:// (wallets understand this)
      attributes: Array.isArray(attributes) ? attributes : [
        { trait_type: 'Game', value: 'Puzzle' },
        { trait_type: 'Timer', value: '30s' }
      ]
    };

    // (CHANGED) 3) upload metadata JSON to Pinata
    const metaRes = await fetch(PINATA_JSON_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!metaRes.ok) {
      const errText = await safeText(metaRes);
      return json(metaRes.status, { error: `Metadata upload failed: ${errText || metaRes.statusText}` });
    }

    const metaJson = await metaRes.json();
    const metaCid = metaJson?.IpfsHash;
    if (!metaCid) return json(500, { error: 'Pinata metadata response missing IpfsHash' });

    const metaIpfs = `ipfs://${metaCid}`;
    const metaGateway = `https://gateway.pinata.cloud/ipfs/${metaCid}`;

    // (CHANGED) 4) return both ipfs:// and HTTPS gateway URLs
    return json(200, {
      uri: metaIpfs,            // canonical IPFS URI
      uriGateway: metaGateway,  // HTTPS JSON URL (use this in mint to avoid "lost metadata")
      imageGateway,             // handy for previews
    });

  } catch (err) {
    console.error(err);
    return json(500, { error: err?.message || 'Internal Error' });
  }
}

/* ==== helpers (new) ==== */
function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}
