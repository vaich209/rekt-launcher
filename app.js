const connectBtn = document.getElementById("connectBtn");
const createBtn = document.getElementById("createBtn");
const walletEl = document.getElementById("wallet");

if (createBtn) {
  createBtn.disabled = true;
}

if (connectBtn) {
  connectBtn.addEventListener("click", async () => {

    if (walletEl) {
      walletEl.textContent = "Connect button works...";
    }

    const provider =
      window.phantom?.solana ||
      window.solana;

    if (!provider?.isPhantom) {
      if (walletEl) {
        walletEl.textContent =
          "Phantom provider not detected.";
      }
      return;
    }

    try {
      if (walletEl) {
        walletEl.textContent =
          "Requesting Phantom connection...";
      }

      const response = await provider.connect();

      if (walletEl) {
        walletEl.textContent =
          "CONNECTED: " +
          response.publicKey.toString();
      }

    } catch (err) {
      if (walletEl) {
        walletEl.textContent =
          "Connection error: " +
          (err?.message || String(err));
      }
    }
  });
}