// netlify/functions/upload.js
const fetch = require('node-fetch');   // v2.x
const FormData = require('form-data');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  try {
    // Preflight for browsers
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const PINATA_JWT = process.env.PINATA_JWT;
    if (!PINATA_JWT) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'PINATA_JWT not configured' }) };
    }

    // Expect { image: "data:image/png;base64,...." }
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const dataUrl = body.image;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing or invalid image data URL' }) };
    }

    // Convert data URL -> Buffer
    const base64 = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');

    // 1) Upload image to Pinata
    const imageForm = new FormData();
    imageForm.append('file', buffer, { filename: 'puzzle.png', contentType: 'image/png' });

    const imageRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: imageForm
    });

    if (!imageRes.ok) {
      const t = await imageRes.text();
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: `Image upload failed`, detail: t }) };
    }

    const imageJson = await imageRes.json();
    const imageCid = imageJson.IpfsHash;
    const imageGateway = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // 2) Upload metadata JSON
const metadata = {
  name: 'MONCOCK PUZZLE',
  description: 'A unique puzzle arrangement created in the MONCOCK PUZZLE game',
  image: imageGateway,   // keep this as the HTTPS gateway so explorers can render it
  attributes: [
    { trait_type: 'Game', value: 'MONCOCK' },
    { trait_type: 'Creation Date', value: new Date().toISOString() }
  ]
};


    const metaRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!metaRes.ok) {
      const t = await metaRes.text();
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: `Metadata upload failed`, detail: t }) };
    }

    const metaJson = await metaRes.json();
    const metadataCid = metaJson.IpfsHash;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        uri: `ipfs://${metadataCid}`,
        imageGateway
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Unexpected server error', detail: err.message }) };
  }
};
