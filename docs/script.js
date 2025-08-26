// ✅ MONCOCK PUZZLE — script.js
// wallet-first + safe image loader + square normalize + canvas render mint
// NOTE: Core behavior preserved. Only additions: 4-tier Rank, snapshot freeze, optional metadata preview.

// ── SETTINGS ──────────────────────────────────────────
const NORMALIZE_SIZE = 600;           // square size (px) used to normalize art
const CONTRACT_ADDRESS = '0x259C1Da2586295881C18B733Cb738fe1151bD2e5';
const CHAIN_ID_HEX = '0x279F';        // 10143 (Monad Testnet)
const API_BASE = '';                  // Netlify redirect /api/* → functions
const ROWS = 3, COLS = 3;

// ── CONTRACT ABI ──────────────────────────────────────
// Keep this aligned with your deployed contract.
// This ABI assumes mintNFT(address to, string tokenURI). If your contract differs, keep your original ABI.
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
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string",  "name": "tokenURI", "type": "string" }
    ],
    "name": "mintNFT",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "string", "name": "newBaseURI", "type": "string" }], "name": "setBaseURI", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "nextTokenId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

// ── ELEMENTS ──────────────────────────────────────────
const connectInjectedBtn = document.getElementById('connectInjectedBtn');
const connectWalletConnectBtn = document.getElementById('connectWalletConnectBtn'); // reserved if you add WC later
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const mintBtn = document.getElementById('mintBtn');
const timeLeftEl = document.getElementById('timeLeft');
const previewImg = document.getElementById('previewImg');
const puzzleGrid = document.getElementById('puzzleGrid');
const mintStatusEl = document.getElementById('mintStatus');

// ── WEB3 STATE ────────────────────────────────────────
let provider, signer, contract;
let imageList = [];
let currentImageEl = null;  // normalized <img> used for minting
let timerHandle, timeLeft = 30;
let draggedPiece = null, sourceSlot = null;

// ── RANKING STATE ─────────────────────────────────────
// We measure start time precisely and record first moment of 100%.
let gameStartedAtSec = null;   // perf-based start time
let completedAtSec = null;     // first time reaching 100%

function nowSec(){ return performance.now()/1000; }
function getElapsedSec(){
  if(gameStartedAtSec==null) return 0;
  return Math.max(0, nowSec() - gameStartedAtSec);
}
function getProgress(){
  const slots = [...puzzleGrid.querySelectorAll('.slot')];
  let correct = 0;
  for(const s of slots){
    const piece = s.firstElementChild;
    if(piece && Number(s.dataset.slot)===Number(piece.dataset.piece)) correct++;
  }
  const total = ROWS*COLS;
  const percent = Math.round((correct/total)*100);
  return {correct,total,percent};
}
function maybeMarkCompleted(){
  const {percent} = getProgress();
  if(percent===100 && completedAtSec==null){
    completedAtSec = getElapsedSec();
    console.log('[score] completed at', completedAtSec.toFixed(2),'s');
  }
}

// 4-tier rank logic (Diamond/Gold/Silver/Bronze)
function computeRank(percent, elapsed, completedAt){
  const finishTime = (completedAt ?? elapsed);
  if (percent === 100 && finishTime <= 10) return 'Diamond'; // perfect + fast
  if (percent === 100)                      return 'Gold';    // perfect but slower
  if (percent >= 50 && percent < 100 && elapsed <= 20) return 'Silver';
  return 'Bronze';
}

// Freeze score exactly when Mint is clicked
function freezeScoreForMint(){
  const {percent, total, correct} = getProgress();
  const elapsed = getElapsedSec();
  const effectiveTime = (percent===100 && completedAtSec!=null) ? completedAtSec : elapsed;
  const rank = computeRank(percent, elapsed, completedAtSec);
  return {
    percent,
    correct,
    total,
    timeSec: Number(effectiveTime.toFixed(2)),      // displayed time
    elapsedSec: Number(elapsed.toFixed(2)),         // raw elapsed-at-click
    completedAtSec: completedAtSec!=null ? Number(completedAtSec.toFixed(2)) : null,
    rank
  };
}

// ── HELPERS ──────────────────────────────────────────
function setMintStatus(msg){ if(mintStatusEl) mintStatusEl.textContent = msg; }

function fetchWithTimeout(url, opts={}, ms=15000){
  return Promise.race([
    fetch(url, opts),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout')), ms))
  ]);
}

function warm(url, times=1){
  for(let i=0;i<times;i++) fetchWithTimeout(url,{method:'GET',cache:'no-store'},3500).catch(()=>{});
}

// Load list.json
async function loadImageList(){
  const res = await fetch('list.json',{cache:'no-store'});
  if(!res.ok) return [];
  return res.json().catch(()=>[]);
}

function pickRandomImage(list){
  if(!list.length) throw new Error('No images in list.json');
  return list[Math.floor(Math.random()*list.length)];
}

// normalize image to square dataURL
async function normalizeImage(url, size){
  const img = new Image(); img.crossOrigin='anonymous';
  img.src = url; await img.decode();
  const minSide = Math.min(img.width, img.height);
  const sx = (img.width - minSide)/2;
  const sy = (img.height - minSide)/2;
  const cnv = document.createElement('canvas'); cnv.width = size; cnv.height = size;
  const ctx = cnv.getContext('2d');
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
  return cnv.toDataURL('image/png');
}

function renderBoardToCanvas(){
  const r= puzzleGrid.getBoundingClientRect();
  const w = r.width, h = r.height;
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  const tileW = w/COLS, tileH = h/ROWS;
  for(let i=0;i<ROWS*COLS;i++){
    const slot = puzzleGrid.querySelector(`.slot[data-slot="${i}"]`);
    const piece = slot?.firstElementChild;
    if(!piece) continue;
    const bg = piece.style.backgroundImage.slice(5,-2);
    const pos = piece.style.backgroundPosition.split(' ');
    const bx = -parseFloat(pos[0]), by = -parseFloat(pos[1]);
    const img = new Image(); img.src = bg;
    // This sync draw is okay because bg is the same normalized image (cached)
    ctx.drawImage(img, bx, by, tileW, tileH, (i%COLS)*tileW, Math.floor(i/COLS)*tileH, tileW, tileH);
  }
  return canvas;
}

// ── PUZZLE BUILDING ──────────────────────────────────
function makeSlot(i){
  const slot=document.createElement('div');
  slot.className='slot'; slot.dataset.slot=i;
  slot.addEventListener('dragover',e=>e.preventDefault());
  slot.addEventListener('dragenter',e=>e.preventDefault());
  slot.addEventListener('drop',e=>handleDropOnSlot(e,slot));
  return slot;
}
function makePiece(i,imgUrl,tileW,tileH){
  const cell=document.createElement('div');
  cell.className='cell'; cell.dataset.piece=i;
  const x=(i%COLS)*tileW, y=Math.floor(i/COLS)*tileH;
  Object.assign(cell.style,{
    backgroundImage:`url(${imgUrl})`,
    backgroundSize:`${COLS*tileW}px ${ROWS*tileH}px`,
    backgroundPosition:`-${x}px -${y}px`,
    width:'100%', height:'100%'
  });
  cell.draggable=true;
  cell.addEventListener('dragstart',e=>{
    const parentSlot=cell.parentElement;
    if(parentSlot?.classList.contains('locked')){ e.preventDefault(); return; }
    draggedPiece=cell; sourceSlot=parentSlot; cell.classList.add('dragging');
    e.dataTransfer.setData('text/plain',cell.dataset.piece);
    e.dataTransfer.effectAllowed='move'; e.dataTransfer.dropEffect='move';
    const ghost=document.createElement('div'); ghost.style.width='1px'; ghost.style.height='1px';
    document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost,0,0); setTimeout(()=>ghost.remove(),0);
  });
  cell.addEventListener('dragend',()=>cell.classList.remove('dragging'));
  return cell;
}

function checkAndLockSlot(slot){
  const piece=slot.firstElementChild; if(!piece) return;
  const correct=Number(slot.dataset.slot)===Number(piece.dataset.piece);
  if(correct){ slot.classList.add('locked'); piece.classList.add('locked'); piece.draggable=false; }
  else{ slot.classList.remove('locked'); piece.classList.remove('locked'); piece.draggable=true; }
  maybeMarkCompleted();
}

function handleDropOnSlot(e,targetSlot){
  e.preventDefault(); if(!draggedPiece) return;
  if(targetSlot.classList.contains('locked')) return;
  if(sourceSlot?.classList.contains('locked')) return;
  const occupant=targetSlot.firstElementChild;
  targetSlot.appendChild(draggedPiece);
  if(occupant) sourceSlot.appendChild(occupant);
  checkAndLockSlot(targetSlot); if(sourceSlot) checkAndLockSlot(sourceSlot);
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}

function makeGrid(){
  puzzleGrid.innerHTML='';
  puzzleGrid.style.setProperty('--rows', ROWS);
  puzzleGrid.style.setProperty('--cols', COLS);
  for(let i=0;i<ROWS*COLS;i++){
    puzzleGrid.appendChild(makeSlot(i));
  }
}

function buildPuzzle(imgUrl){
  puzzleGrid.innerHTML='';
  const slots=[];
  for(let i=0;i<ROWS*COLS;i++){ const s=makeSlot(i); slots.push(s); puzzleGrid.appendChild(s); }
  const r=slots[0].getBoundingClientRect(), tileW=r.width, tileH=r.height;
  const pieces=[]; for(let i=0;i<ROWS*COLS;i++) pieces.push(makePiece(i,imgUrl,tileW,tileH));
  shuffle(pieces);
  for(let i=0;i<slots.length;i++){ slots[i].appendChild(pieces[i]); checkAndLockSlot(slots[i]); }
}

// ── TIMER ────────────────────────────────────────────
function startTimer(){
  clearInterval(timerHandle); timeLeft=30; timeLeftEl.textContent=timeLeft;
  timerHandle=setInterval(()=>{
    timeLeftEl.textContent=--timeLeft;
    if(timeLeft<=0){
      clearInterval(timerHandle);
      alert('⏳ Time’s up! This is your masterpiece — mint it or restart.');
      startBtn.disabled=false; restartBtn.disabled=false;
    }
  },1000);
}

// ── WALLET & CHAIN ───────────────────────────────────
// (Assumes ethers is present globally via <script> tag)
function getInjectedProvider(){
  if(window.ethereum) return window.ethereum;
  if(window.backpack?.ethereum) return window.backpack.ethereum;
  return null;
}

async function switchToMonad(ethersProvider){
  const eth = ethersProvider.provider;
  try{
    await eth.request({ method:'wallet_switchEthereumChain', params:[{ chainId: CHAIN_ID_HEX }] });
  }catch(err){
    if(err?.code===4902){
      await eth.request({ method:'wallet_addEthereumChain', params:[{
        chainId: CHAIN_ID_HEX,
        chainName: 'Monad Testnet',
        nativeCurrency: { name:'MON', symbol:'MON', decimals:18 },
        rpcUrls: ['https://testnet-rpc.monad.xyz']
      } ]});
    }else{ throw err; }
  }
}

async function finishConnect(ethersProvider){
  provider = ethersProvider;
  signer   = provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  startBtn.disabled=false;
  setMintStatus('Wallet connected. Ready to play.');
}

async function connectInjected(){
  const injected = getInjectedProvider();
  if(!injected){ alert('No injected wallet found. Install/enable MetaMask/Rabby/Backpack or use their in-app browser.'); return; }
  try{
    await injected.request({ method: 'eth_requestAccounts' });
    const ethersProvider = new ethers.providers.Web3Provider(injected, 'any');
    await switchToMonad(ethersProvider);
    await finishConnect(ethersProvider);
  } catch (err) {
    console.error('[wallet] connectInjected failed:', err);
    const code = err?.code;
    if (code === 4001)       alert('Connection rejected in wallet.');
    else if (code === -32002) alert('A connection request is already pending—open your wallet popup.');
    else                      alert('Wallet connection failed: ' + (err?.message || err));
  }
}

// ── UI WIRES ─────────────────────────────────────────
if(connectInjectedBtn) connectInjectedBtn.addEventListener('click', connectInjected);
if(restartBtn){
  restartBtn.addEventListener('click',()=>{
    clearInterval(timerHandle); puzzleGrid.innerHTML=''; timeLeftEl.textContent='30';
    startBtn.disabled=false; mintBtn.disabled=true; restartBtn.disabled=true;
  });
}
if(startBtn){
  startBtn.addEventListener('click', async ()=>{
    try{
      gameStartedAtSec = nowSec(); completedAtSec = null;  // start & reset
      setMintStatus('🎲 Loading artwork…');
      const url = pickRandomImage(imageList);
      const normalized = await normalizeImage(url, NORMALIZE_SIZE);
      currentImageEl = new Image(); currentImageEl.src = normalized; await currentImageEl.decode();

      makeGrid();
      const r=puzzleGrid.getBoundingClientRect(), tileW=r.width/COLS, tileH=r.height/ROWS;
      const pieces=[]; for(let i=0;i<ROWS*COLS;i++) pieces.push(makePiece(i,currentImageEl.src,tileW,tileH));
      shuffle(pieces);
      const slots=[...puzzleGrid.querySelectorAll('.slot')];
      for(let i=0;i<slots.length;i++){ slots[i].appendChild(pieces[i]); checkAndLockSlot(slots[i]); }

      startTimer();
      restartBtn.disabled=false; mintBtn.disabled=false; startBtn.disabled=true;
      setMintStatus('🧩 Go! Solve and mint anytime.');
    }catch(err){
      console.error('start error:', err);
      alert('Failed to start game: ' + (err?.message || String(err)));
      startBtn.disabled=false;
    }
  });
}

// ── MINT (server builds metadata; uses uriGateway) ───
async function mintSnapshot(){
  try{
    if(!puzzleGrid.children.length) throw new Error('No puzzle to mint');
    if(!currentImageEl) throw new Error('No image loaded for this round');

    mintBtn.disabled=true; setMintStatus('⚙️ Warming up backend…');
    try{ await fetchWithTimeout(`${API_BASE}/api/upload?warm=1`,{method:'HEAD',cache:'no-store'},4000); }catch{}

    setMintStatus('🧩 Rendering board…');

    // 🔒 Freeze score exactly at click
    const frozenScore = freezeScoreForMint();
    setMintStatus('🔒 Score locked at click: ' + frozenScore.rank + ' ('+frozenScore.percent+'% in '+frozenScore.timeSec+'s)');

    // Render canvas snapshot
    const canvas   = renderBoardToCanvas();
    const snapshot = canvas.toDataURL('image/png');

    setMintStatus('☁️ Uploading to IPFS…');
    const res = await fetchWithTimeout(`${API_BASE}/api/upload`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ image: snapshot, score: frozenScore })
    },25000);

    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
    const upload = await res.json();
    console.log('[upload]', upload);

    // Optional metadata preview in UI (no layout changes needed)
    window.__lastMetadata = upload?.metadata;
    const box = document.getElementById('metaPreview');
    if (box && upload?.metadata) box.textContent = JSON.stringify(upload.metadata, null, 2);

    const metaGateway = upload.uriGateway;
    if(!metaGateway || !/^https?:\/\//.test(metaGateway)){
      throw new Error('Invalid upload response: missing uriGateway');
    }

    (async()=>{ try{ await warm(metaGateway,2); }catch{} })();
    (async()=>{ try{ if(upload.imageGateway) await warm(upload.imageGateway,1); }catch{} })();

    setMintStatus('⛓️ Sending transaction…');
    const to = await signer.getAddress();
    // If your contract mints without tokenURI, replace this with your original call signature.
    const tx = await contract.mintNFT(to, metaGateway);

    setMintStatus(`🧾 Tx submitted: ${tx.hash.slice(0,10)}… Waiting…`);
    await tx.wait();

    setMintStatus('🎉 Minted!');
    clearInterval(timerHandle);
    startBtn.disabled=false; restartBtn.disabled=false;
    alert('🎉 Minted successfully!');
  }catch(err){
    console.error(err);
    alert('Mint failed: ' + (err?.message || err));
  }finally{
    mintBtn.disabled=false;
  }
}

// ── WIRE UP (wallet-first) ───────────────────────────
if (startBtn) startBtn.disabled = true;  // require wallet before playing
if (mintBtn)  mintBtn.disabled  = true;

if (mintBtn) mintBtn.addEventListener('click', mintSnapshot);

// ── INIT (optional preview) ───────────────────────────
(async function init(){
  try{
    imageList = await loadImageList();
    if(imageList.length){
      const url = pickRandomImage(imageList);
      const normalized = await normalizeImage(url, NORMALIZE_SIZE);
      previewImg.src = normalized;
    }
  }catch(e){
    console.error('init error:', e);
  }
})();
