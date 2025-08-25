// netlify/functions/upload.js
// Node 18+ (fetch, FormData, Blob built-in)

export async function handler(event) {
  try {
    // Warmup ping
    if (event.httpMethod === 'HEAD' && event.queryStringParameters?.warm === '1') {
      return { statusCode: 204 };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { image, name, description, attributes } = JSON.parse(event.body || '{}');
    if (!image || !image.startsWith('data:image/')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid image data' }) };
    }

    // Decode base64 PNG
    const base64 = image.split(',')[1];
    const bytes = Buffer.from(base64, 'base64');

    // ---- 1) Upload image to Pinata ----
    const formImg = new FormData();
    formImg.append('file', new Blob([bytes], { type: 'image/png' }), 'puzzle.png');

    const pinataFile = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
      body: formImg,
    });

    if (!pinataFile.ok) {
      const txt = await pinataFile.text();
      return { statusCode: pinataFile.status, body: JSON.stringify({ error: txt }) };
    }
    const fileJson = await pinataFile.json();
    const imageCid = fileJson.IpfsHash;
    const imageUri = `ipfs://${imageCid}`;
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // ---- 2) Build metadata JSON ----
    const metadata = {
      name: name || 'Moncock Puzzle',
      description: description || 'Snapshot of your puzzle from Moncock Puzzle',
      image: imageUri,
      attributes: Array.isArray(attributes) ? attributes : [],
    };

    // ---- 3) Upload metadata JSON to Pinata ----
    const formMeta = new FormData();
    formMeta.append(
      'file',
      new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }),
      'metadata.json'
    );

    const pinataMeta = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
      body: formMeta,
    });

    if (!pinataMeta.ok) {
      const txt = await pinataMeta.text();
      return { statusCode: pinataMeta.status, body: JSON.stringify({ error: txt }) };
    }
    const metaJson = await pinataMeta.json();
    const metaCid = metaJson.IpfsHash;
    const metaUri = `ipfs://${metaCid}`;
    const uriGateway = `https://gateway.pinata.cloud/ipfs/${metaCid}`;

    // ---- 4) Return both ----
    return {
      statusCode: 200,
      body: JSON.stringify({ imageGateway, uri: metaUri, uriGateway }),
      headers: { 'content-type': 'application/json' },
    };

  } catch (err) {
    console.error('[upload] error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal Error' }) };
  }
}
