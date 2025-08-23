// ✅ MONCOCK PUZZLE — script.js

// ── CONFIG ────────────────────────────────────────────
const CONTRACT_ADDRESS = '0x259C1Da2586295881C18B733Cb738fe1151bD2e5';
const CHAIN_ID = 10143;
const CHAIN_ID_HEX = '0x279F';

const ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  {
    "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "approved", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ], "name": "Approval", "type": "event"
  },
  {
    "anonymous": false, "inputs": [
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

// ── ASSETS CONFIG ─────────────────────────────────────
const GITHUB_OWNER  = 'moncock';
const ASSETS_REPO   = 'MoncockPuzzle';
const GITHUB_BRANCH = 'main';
const IMAGES_PATH   = 'docs/asset/images';
const API_BASE      = ''; // Netlify functions live at /.netlify/functions

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
let timerHandle, timeLeft = 45;
let draggedPiece = null;
let sourceSlot = null;
const ROWS = 3, COLS = 3;

// ── LOG ───────────────────────────────────────────────
console.log('[boot] script.js loaded. ethers?', !!window.ethers);

// ── HELPERS: Providers ────────────────────────────────
function brandName(p) {
  if (!p) return 'Unknown';
  if (p.isMetaMask) return 'MetaMask';
  if (p.isRabby) return 'Rabby';
  if (p.isBackpack) return 'Backpack';
  if (p.isCoinbaseWallet) return 'Coinbase Wallet';
  if (p.isBraveWallet) return 'Brave Wallet';
  if (p.isOKExWallet || p.isOKXWallet) return 'OKX Wallet';
  if (p.isTrust) return 'Trust Wallet';
  if (p.isFrame) return 'Frame';
  if (p.isPhantom || p.isPhantomEthereum) return 'Phantom (EVM)';
  return 'Injected';
}

function getInjectedProvider() {
  const pool = [];
  const eth = window.ethereum;
  if (eth?.providers && Array.isArray(eth.providers)) pool.push(...eth.providers);
  if (eth && !pool.includes(eth)) pool.push(eth);
  if (window.phantom?.ethereum && !pool.includes(window.phantom.ethereum)) pool.push(window.phantom.ethereum);
  if (!pool.length) return null;
  const rank = ["MetaMask","Rabby","Backpack","Coinbase Wallet","Brave Wallet","Phantom (EVM)","OKX Wallet","Trust Wallet","Frame","Injected"];
  pool.sort((a,b)=> rank.indexOf(brandName(a)) - rank.indexOf(brandName(b)));
  return pool[0];
}

async function switchToMonad(ethersProvider) {
  try {
    const chainIdHex = await ethersProvider.send('eth_chainId', []);
    if (chainIdHex?.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return;
    try {
      await ethersProvider.send('wallet_switchEthereumChain', [{ chainId: CHAIN_ID_HEX }]);
    } catch (e) {
      if (e?.code === 4902 || /Unrecognized chain ID/i.test(e?.message || '')) {
        await ethersProvider.send('wallet_addEthereumChain', [{
          chainId: CHAIN_ID_HEX,
          chainName: 'Monad Testnet',
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
          rpcUrls: ['https://testnet-rpc.monad.xyz'],
          blockExplorerUrls: ['https://testnet.monadexplorer.com']
        }]);
      } else {
        throw e;
      }
    }
  } catch (err) {
    console.error('[wallet] switchToMonad error:', err);
    throw new Error('Failed to switch to Monad Testnet: ' + (err.message || err));
  }
}

async function finishConnect(ethersProvider) {
  provider = ethersProvider;
  signer   = provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const addr = await signer.getAddress();
  walletStatus.textContent = `Connected: ${addr.slice(0,6)}...${addr.slice(-4)} (Monad)`;
  startBtn.disabled = false;
  mintBtn.disabled = false;
}

async function connectInjected() {
  console.log('[connect] trying injected provider…');
  const injected = getInjectedProvider();
  if (!injected) {
    alert('No injected wallet found. Install/enable MetaMask/Rabby/Backpack or use their in-app browser.');
    return;
  }
  try {
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
window.connectInjected = connectInjected;

function connectWalletConnect() { alert('WalletConnect coming soon 🤝'); }

// (assets helpers, puzzle logic, timer, mintSnapshot, etc.)
// … [keep your existing puzzle + mintSnapshot code here — unchanged except using metaGateway as I showed earlier] …

// ── WIRE UP BUTTONS ───────────────────────────────────
if (mintBtn) mintBtn.addEventListener('click', mintSnapshot);
if (connectInjectedBtn) connectInjectedBtn.addEventListener('click', connectInjected);
if (connectWalletConnectBtn) connectWalletConnectBtn.addEventListener('click', connectWalletConnect);

// ── INIT ──────────────────────────────────────────────
(async function init() {
  await loadImageList();
  if (imageList.length) previewImg.src = pickRandomImage();
})();
