// /netlify/functions/upload.js
// Node 18+ (Netlify) — uses global fetch
export const config = {
  path: "/api/upload",
};

const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const W3S_URL = "https://api.web3.storage/upload";

function b64ToBuffer(dataUrl) {
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("Bad image dataURL");
  return Buffer.from(m[2], "base64");
}

function pickGateway(cid) {
  const prefix =
    process.env.GATEWAY_PREFIX ||
    (process.env.PINATA_JWT ? "https://gateway.pinata.cloud/ipfs/" : "https://w3s.link/ipfs/");
  return prefix + cid;
}

async function uploadFilePinata(filename, contentBuffer, contentType) {
  const form = new FormData();
  form.append("file", new Blob([contentBuffer], { type: contentType }), filename);
  const res = await fetch(PINATA_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata file upload failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.IpfsHash; // CID
}

async function uploadJsonPinata(jsonObj) {
  const res = await fetch(PINATA_JSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: JSON.stringify(jsonObj),
  });
  if (!res.ok) throw new Error(`Pinata JSON upload failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.IpfsHash; // CID
}

async function uploadRawW3S(bytesOrString, contentType) {
  const res = await fetch(W3S_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WEB3_STORAGE_TOKEN}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytesOrString,
  });
  if (!res.ok) throw new Error(`web3.storage upload failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.cid; // CID
}

function buildMetadata({ imageCid, imageType, score }) {
  const { rank, percent, correct, total, timeSec, elapsedSec, completedAtSec } = score || {};
  const name = `Moncock Puzzle — ${rank || "Unranked"}`;
  const description =
    "Minted from the Moncock Puzzle. Score is locked at the instant of clicking Mint (network lag doesn't affect rank).";
  const image = `ipfs://${imageCid}`;

  // Traits for Magic Eden (simple, filterable)
  const attributes = [
    { trait_type: "Rank", value: rank || "Unknown" },
    { trait_type: "Completion (%)", value: percent ?? 0 },
    { trait_type: "Tiles Correct", value: `${correct ?? 0}/${total ?? 0}` },
    { trait_type: "Time (s)", value: Number(timeSec ?? 0) },
    { trait_type: "Grid", value: `${total ? Math.sqrt(total) : "?"}x${total ? Math.sqrt(total) : "?"}` },
    { trait_type: "Snapshot", value: "Locked-at-click" },
  ];

  const properties = {
    category: "image",
    files: [{ uri: image, type: imageType }],
    score: {
      // keep the full score object for explorers / power users
      ...score,
    },
  };

  return {
    name,
    description,
    image,
    attributes,
    properties,
  };
}

export default async (req, context) => {
  try {
    if (req.method === "HEAD") {
      return new Response(null, { status: 204 });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await req.json();
    const { image, score } = body || {};
    if (!image || !score) {
      return new Response("Missing image or score", { status: 400 });
    }

    // decode PNG
    const pngBuf = b64ToBuffer(image);
    const imageType = "image/png";

    const usePinata = !!process.env.PINATA_JWT;
    const useW3S = !!process.env.WEB3_STORAGE_TOKEN;
    if (!usePinata && !useW3S) {
      return new Response(
        "No IPFS provider configured. Set PINATA_JWT or WEB3_STORAGE_TOKEN in Netlify environment variables.",
        { status: 500 }
      );
    }

    // 1) Upload image
    let imageCid;
    if (usePinata) imageCid = await uploadFilePinata("puzzle.png", pngBuf, imageType);
    else imageCid = await uploadRawW3S(pngBuf, imageType);

    // 2) Build metadata (with traits)
    const metadata = buildMetadata({ imageCid, imageType, score });

    // 3) Upload metadata JSON
    let metadataCid;
    if (usePinata) metadataCid = await uploadJsonPinata(metadata);
    else metadataCid = await uploadRawW3S(JSON.stringify(metadata), "application/json");

    // 4) Return both URIs + gateways + echo metadata (for on-page preview)
    const uri = `ipfs://${metadataCid}`;
    const uriGateway = pickGateway(metadataCid);
    const imageGateway = pickGateway(imageCid);

    return Response.json(
      {
        ok: true,
        uri,
        uriGateway,
        imageGateway,
        metadata, // for your UI preview
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[upload] error:", err);
    return new Response(String(err?.message || err), { status: 500 });
  }
};
