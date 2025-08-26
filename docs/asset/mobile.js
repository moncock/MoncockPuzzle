// mobile.js — add tap-to-swap puzzle support for phones

(function() {
  // Only run on mobile devices
  if (!/Mobi|Android/i.test(navigator.userAgent)) return;

  console.log('[mobile patch] tap-to-swap enabled');

  let selectedPieceEl = null;

  function selectPiece(el) {
    if (selectedPieceEl) selectedPieceEl.classList.remove('selected');
    selectedPieceEl = el;
    if (el) el.classList.add('selected');
  }

  function swapPieces(slotA, slotB) {
    if (!slotA || !slotB || slotA === slotB) return;
    const a = slotA.firstElementChild;
    const b = slotB.firstElementChild;
    if (!a && !b) return;
    if (a) slotB.appendChild(a);
    if (b) slotA.appendChild(b);

    if (window.checkAndLockSlot) {
      window.checkAndLockSlot(slotA);
      window.checkAndLockSlot(slotB);
    }
  }

  function handleTapOnPiece(pieceEl) {
    const slot = pieceEl.parentElement;
    if (slot?.classList.contains('locked')) return;

    if (!selectedPieceEl) {
      selectPiece(pieceEl);
      return;
    }

    const fromSlot = selectedPieceEl.parentElement;
    const toSlot   = slot;
    selectPiece(null);
    swapPieces(fromSlot, toSlot);
  }

  function handleTapOnSlot(slot) {
    if (slot.classList.contains('locked')) return;

    if (selectedPieceEl) {
      const fromSlot = selectedPieceEl.parentElement;
      selectPiece(null);
      swapPieces(fromSlot, slot);
    }
  }

  // Patch makePiece to add tap/click handlers
  const oldMakePiece = window.makePiece;
  if (typeof oldMakePiece === 'function') {
    window.makePiece = function(i, imgUrl, tileW, tileH) {
      const piece = oldMakePiece(i, imgUrl, tileW, tileH);
      piece.addEventListener('click', () => handleTapOnPiece(piece));
      piece.addEventListener('touchend', e => {
        e.preventDefault();
        handleTapOnPiece(piece);
      }, { passive: false });
      return piece;
    };
  }

  // Patch makeSlot to add tap/click handlers
  const oldMakeSlot = window.makeSlot;
  if (typeof oldMakeSlot === 'function') {
    window.makeSlot = function(i) {
      const slot = oldMakeSlot(i);
      slot.addEventListener('click', () => handleTapOnSlot(slot));
      slot.addEventListener('touchend', e => {
        e.preventDefault();
        handleTapOnSlot(slot);
      }, { passive: false });
      return slot;
    };
  }

  // Simple style tweak for selected piece
  const style = document.createElement('style');
  style.textContent = `
    .cell.selected {
      outline: 3px solid #6366f1;
      box-shadow: 0 0 0 3px #c7d2fe inset;
    }
  `;
  document.head.appendChild(style);

})();
