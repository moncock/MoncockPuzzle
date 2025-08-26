// ✅ MONCOCK PUZZLE — script.js
// wallet-first + safe image loader + square normalize + canvas render mint
// ranks (Diamond/Gold/Silver/Bronze) + instant feedback mint flow

// ── SETTINGS ──────────────────────────────────────────
const NORMALIZE_SIZE = 600;           // square size (px) used to normalize art
const CONTRACT_ADDRESS = '0x259C1Da2586295881C18B733Cb738fe1151bD2e5';
const CHAIN_ID_HEX = '0x279F';        // 10143 (Monad Testnet)
const API_BASE = '';                  // Netlify redirect /api/* → functions
const ROWS = 3, COLS = 3;

// ---- Rank rules (tweak later if you want) ----
const RANK_RULES = {
  diamondTimeSec: 10,  // ✅ must be 100% and ≤10s for DIAMOND
  goldTimeSec: 20,     // 100% but slower, or very high completion fast
  goldMinPct: 90,      // ≥90% within goldTimeSec → GOLD
  silverMinPct: 50     // 50–89% → SILVER
};

// ── CONTRACT ABI ──────────────────────────────────────
const ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "approved", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ], "name": "Approval", "type": "event"
  },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "operator", "type": "address" },
      { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }
    ], "name": "ApprovalForAll", "type": "event"
  },
  { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "_fromTokenId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "_toTokenId", "type": "uint256" }], "name": "BatchMetadataUpdate", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "MetadataUpdate", "type": "event" },
  { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "string", "name": "uri", "type": "string" }], "name": "mintNFT", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bytes", "name": "data", "type": "bytes" }], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "Transfer", "type": "event" },
  { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "transferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "getApproved", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "nextTokenId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }], "name": "supportsInterface", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "tokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

// ── ASSET HELPERS ─────────────────────────────────────
function imageUrl(file) { return `${location.origin}/asset/images/${file}`; }

async function loadImageList() {
  const url = `${location.origin}/list.json?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`list.json HTTP ${res.status}`);
  return res.json();
}

function pickRandomImage(list) {
  const file = list[Math.floor(Math.random() * list.length)];
  return imageUrl(file);
}

// SAFE image loader: works for http(s) and data: URLs
async function loadHTMLImage(url) {
  const img = new Image();
  const isData = /^data:/i.test(url);
  const isHttp = /^https?:/i.test(url);
  if (isHttp) img.crossOrigin = 'anonymous';

  return await new Promise((resolve, reject) => {
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${isData ? '[data URL]' : url}`));
    img.src = isData ? url : url + (url.includes('?') ? '&' : '?') + 'cachebust=' + Date.now();
  });
}

/** Normalize any aspect ratio to a square dataURL (letterboxed on white) */
async function normalizeImage(url, size = NORMALIZE_SIZE, bg = '#ffffff') {
  const img = await loadHTMLImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);

  const ratio = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  return canvas.toDataURL('image/png');
}

// ── UI ELEMENTS ───────────────────────────────────────
const connectInjectedBtn      = document.getElementById('connectInjectedBtn');
const connectWalletConnectBtn = document.getElementById('connectWalletConnectBtn');
const walletStatus            = document.getElementById('walletStatus');
const startBtn                = document.getElementById('startBtn');
const mintBtn                 = document.getElementById('mintBtn');
const restartBtn              = document.getElementById('restartBtn');
const timeLeftEl              = document.getElementById('timeLeft');
const puzzleGrid              = document.getElementById('puzzleGrid');
const previewImg              = document.getElementById('previewImg');

// ── STATE ─────────────────────────────────────────────
let provider, signer, contract;
let imageList = [];
let currentImageEl = null;  // normalized <img> used for minting
let timerHandle, timeLeft = 30;
let draggedPiece = null, sourceSlot = null;

// ── LOG ───────────────────────────────────────────────
console.log('[boot] script.js loaded. ethers?', !!window.ethers);

// ── WALLET ────────────────────────────────────────────
// (unchanged: brandName, getInjectedProvider, switchToMonad, finishConnect, connectInjected, etc.)

// ── PUZZLE (fixed slots) ──────────────────────────────
// (unchanged: shuffle, makeSlot, makePiece, handleDropOnSlot, checkAndLockSlot, buildPuzzle, startTimer)

// ── RANK HELPERS ──────────────────────────────────────
function getCompletionPercent() {
  const slots = Array.from(puzzleGrid.querySelectorAll('.slot'));
  if (!slots.length) return 0;
  let correct = 0;
  for (const s of slots) {
    const p = s.firstElementChild;
    if (p && Number(s.dataset.slot) === Number(p.dataset.piece)) correct++;
  }
  return Math.round((correct / (ROWS * COLS)) * 100);
}

// NEW: correct/total helper
function getCorrectAndTotal() {
  const slots = Array.from(puzzleGrid.querySelectorAll('.slot'));
  let correct = 0;
  for (const s of slots) {
    const p = s.firstElementChild;
    if (p && Number(s.dataset.slot) === Number(p.dataset.piece)) correct++;
  }
  return { correct, total: ROWS * COLS };
}

function getRankFromPercent(pct, elapsedSeconds) {
  if (pct === 100 && elapsedSeconds <= RANK_RULES.diamondTimeSec) return 'Diamond';
  if ((pct === 100 && elapsedSeconds <= RANK_RULES.goldTimeSec) ||
      (pct >= RANK_RULES.goldMinPct && elapsedSeconds <= RANK_RULES.goldTimeSec)) return 'Gold';
  if (pct >= RANK_RULES.silverMinPct) return 'Silver';
  return 'Bronze';
}

// ── UTILS ─────────────────────────────────────────────
// (unchanged: warm, setMintStatus, fetchWithTimeout, explorerTxUrl)

// ── RENDER BOARD → CANVAS (no html2canvas) ───────────
// (unchanged)

// ── MINT (instant feedback; confirm in background) ───
async function mintSnapshot(){
  try{
    if(!puzzleGrid.children.length) throw new Error('No puzzle to mint');
    if(!currentImageEl) throw new Error('No image loaded for this round');

    // 1) Render the board → snapshot
    setMintStatus('🧩 Rendering board…');
    const canvas   = renderBoardToCanvas();
    const snapshot = canvas.toDataURL('image/png');

    previewImg.src = snapshot;

    // 2) Warm backend
    setMintStatus('⚙️ Warming up backend…');
    try { await fetchWithTimeout(`${API_BASE}/api/upload?warm=1`, { method:'HEAD', cache:'no-store' }, 4000); } catch {}

    // 3) Freeze score at click
    const completion = getCompletionPercent();
    const { correct, total } = getCorrectAndTotal();
    const elapsed    = 30 - timeLeft;
    const rank       = getRankFromPercent(completion, elapsed);

    setMintStatus(`🔒 Score locked at click: ${rank} (${completion}% in ${elapsed.toFixed(2)}s)`);

    // 4) Upload to backend
    setMintStatus('☁️ Uploading to IPFS…');
    const res = await fetchWithTimeout(`${API_BASE}/api/upload`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        image: snapshot,
        name: 'Moncock Puzzle',
        description: 'Snapshot of your puzzle from Moncock Puzzle.',
        attributes: [
          { trait_type:'Game', value:'Puzzle' },
          { trait_type:'Completion (%)', value: completion },
          { trait_type:'Time (s)', value: Number(elapsed.toFixed(2)) },
          { trait_type:'Rank', value: rank },
          { trait_type:'Tiles Correct', value: `${correct}/${total}` }
        ],
        score: {
          rank,
          percent: completion,
          correct,
          total,
          timeSec: Number(elapsed.toFixed(2)),
          elapsedSec: Number(elapsed.toFixed(2)),
          completedAtSec: completion === 100 ? Number(elapsed.toFixed(2)) : null
        }
      })
    }, 25000);

    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
    const upload = await res.json();
    const metaGateway = upload.uriGateway;
    if(!metaGateway || !/^https?:\/\//.test(metaGateway)){
      console.error('Upload response:', upload);
      throw new Error('Invalid upload response: missing uriGateway');
    }

    (async()=>{ try{ await warm(metaGateway,2); }catch{} })();
    (async()=>{ try{ if(upload.imageGateway) await warm(upload.imageGateway,1); }catch{} })();

    setMintStatus('⛓️ Sending transaction… open your wallet');
    mintBtn.disabled = true;
    const to = await signer.getAddress();
    const tx = await contract.mintNFT(to, metaGateway);

    const url = explorerTxUrl(tx.hash);
    setMintStatus(`📤 Transaction sent. Waiting on-chain…\n${url}`);
    mintBtn.disabled = false;
    startBtn.disabled = false;
    restartBtn.disabled = false;
    clearInterval(timerHandle);

    provider.waitForTransaction(tx.hash, 1)
      .then(() => {
        setMintStatus(`✅ Confirmed on-chain!\n${url}`);
        alert('🎉 Mint confirmed!');
      })
      .catch(err => {
        console.error('waitForTransaction error:', err);
        setMintStatus(`⚠️ Could not confirm yet. You can check here:\n${url}`);
      });

  }catch(err){
    console.error(err);
    setMintStatus('❌ Mint failed');
    alert('Mint failed: ' + (err?.message || err));
    mintBtn.disabled = false;
  }
}

// ── CONTROLS / WIRE-UP / INIT ─────────────────────────
// (unchanged from your version, just left as-is)
