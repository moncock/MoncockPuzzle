// netlify/functions/upload.js
// Uses Node 18 built-ins: fetch, FormData, Blob

export async function handler(event) {
  try {
    if (event.httpMethod === 'HEAD' && event.queryStringParameters?.warm === '1') {
      return { statusCode: 204 };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { image } = JSON.parse(event.body || '{}');
    if (!image || !image.startsWith('data:image/')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid image data' }) };
    }

    // Decode base64 data URL -> Buffer
    const base64 = image.split(',')[1];
    const bytes = Buffer.from(base64, 'base64');

    // Build multipart form with built-in FormData/Blob
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'puzzle.png');

    // Example: upload to Pinata (replace with your endpoint + auth)
    // const pinataEndpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    // const res = await fetch(pinataEndpoint, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    //   body: form,
    // });

    // --- Demo stub: pretend we uploaded and return fake URIs ---
    const fakeImageCid = 'bafy...image';
    const fakeMetaCid  = 'bafy...meta';
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${fakeImageCid}`;
    const metaUri      = `ipfs://${fakeMetaCid}`;

    // If you actually call a real API above, uncomment this and parse:
    // if (!res.ok) {
    //   const txt = await res.text();
    //   return { statusCode: res.status, body: JSON.stringify({ error: txt || 'Upload failed' }) };
    // }
    // const json = await res.json();
    // const imageGateway = ...; const metaUri = ...;

    return {
      statusCode: 200,
      body: JSON.stringify({ imageGateway, uri: metaUri }),
      headers: { 'content-type': 'application/json' },
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal Error' }) };
  }
}
