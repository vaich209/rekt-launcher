import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "https://esm.sh/@solana/web3.js@1.98.4";

import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  AuthorityType,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
} from "https://esm.sh/@solana/spl-token@0.4.14";

/* =========================================================
   $REKT DEVNET LAUNCHER
   DEVNET ONLY — NO MAINNET TRANSACTIONS
   ========================================================= */

const NETWORK = "devnet";
const RPC_URL = clusterApiUrl(NETWORK);

const connection = new Connection(RPC_URL, "confirmed");

const DECIMALS = 6;
const SUPPLY = 100_000_000n;
const RAW_SUPPLY = SUPPLY * 10n ** BigInt(DECIMALS);

let provider = null;
let walletPublicKey = null;
let creating = false;

/* ---------------- DOM ---------------- */

const connectBtn = document.getElementById("connectBtn");
const createBtn = document.getElementById("createBtn");
const walletEl = document.getElementById("wallet");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function setResult(html = "") {
  if (resultEl) resultEl.innerHTML = html;
}

/* ---------------- PHANTOM ---------------- */

function getProvider() {
  if (window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }

  if (window.solana?.isPhantom) {
    return window.solana;
  }

  return null;
}

function openInPhantom() {
  const currentUrl = window.location.href;

  const phantomUrl =
    "https://phantom.app/ul/browse/" +
    encodeURIComponent(currentUrl) +
    "?ref=" +
    encodeURIComponent(currentUrl);

  window.location.href = phantomUrl;
}

/* ---------------- BALANCE ---------------- */

async function refreshBalance() {
  if (!walletPublicKey) return;

  try {
    const lamports = await connection.getBalance(
      walletPublicKey,
      "confirmed"
    );

    const sol = lamports / LAMPORTS_PER_SOL;

    if (walletEl) {
      walletEl.innerHTML =
        `Wallet:<br>${walletPublicKey.toBase58()}` +
        `<br><br>Devnet balance: <strong>${sol.toFixed(4)} SOL</strong>`;
    }

    return sol;
  } catch (err) {
    console.error("Balance error:", err);
    return null;
  }
}

/* ---------------- CONNECT ---------------- */

async function connectWallet() {
  try {
    provider = getProvider();

    if (!provider) {
      openInPhantom();
      return;
    }

    setStatus("Connecting Phantom...");

    const response = await provider.connect();

    walletPublicKey = new PublicKey(
      response.publicKey.toString()
    );

    connectBtn.textContent = "Phantom connected";
    createBtn.disabled = false;

    setStatus("Phantom connected.");

    await refreshBalance();

  } catch (err) {
    console.error(err);

    setStatus(
      "Connection failed: " +
      (err?.message || String(err))
    );
  }
}

/* =========================================================
   BUILD TRANSACTION

   IMPORTANT:
   Blockhash is obtained immediately before signing.
   ========================================================= */

async function buildCreateMintTransaction(mintKeypair) {
  const owner = walletPublicKey;

  const rent =
    await connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );

  const ata = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    owner,
    false,
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction();

  /* Create mint account */

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  /* Initialize mint */

  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      owner,
      owner,
      TOKEN_PROGRAM_ID
    )
  );

  /* Create user's token account */

  tx.add(
    createAssociatedTokenAccountInstruction(
      owner,
      ata,
      owner,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID
    )
  );

  /* Mint 100M */

  tx.add(
    createMintToInstruction(
      mintKeypair.publicKey,
      ata,
      owner,
      RAW_SUPPLY,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  /* Permanently revoke mint authority */

  tx.add(
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      owner,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  /* Permanently revoke freeze authority */

  tx.add(
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      owner,
      AuthorityType.FreezeAccount,
      null,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  /*
   * Get the blockhash LAST.
   * This reduces the chance that Phantom receives
   * an already stale blockhash.
   */

  const latest = await connection.getLatestBlockhash(
    "confirmed"
  );

  tx.feePayer = owner;
  tx.recentBlockhash = latest.blockhash;

  /*
   * Mint account must sign because SystemProgram
   * creates this new account.
   */

  tx.partialSign(mintKeypair);

  return {
    tx,
    latest,
    ata,
  };
}

/* ---------------- SEND ---------------- */

async function signSendAndConfirm(tx, latest) {
  setStatus("Waiting for Phantom approval...");

  /*
   * Phantom signs.
   * It does NOT receive or expose any private key.
   */

  const signed = await provider.signTransaction(tx);

  setStatus("Sending transaction to Solana Devnet...");

  const signature = await connection.sendRawTransaction(
    signed.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 5,
    }
  );

  setStatus("Confirming transaction...");

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(
      "Transaction failed: " +
      JSON.stringify(confirmation.value.err)
    );
  }

  return signature;
}

/* =========================================================
   CREATE REKT
   ========================================================= */

async function createREKT() {
  if (creating) return;

  if (!provider || !walletPublicKey) {
    setStatus("Connect Phantom first.");
    return;
  }

  creating = true;
  createBtn.disabled = true;

  setResult("");

  /*
   * Generate mint keypair locally.
   *
   * This is NOT the user's wallet private key.
   * It is only the temporary signing key required
   * to create the new mint account.
   */

  const mintKeypair = Keypair.generate();

  try {
    const balance = await connection.getBalance(
      walletPublicKey,
      "confirmed"
    );

    if (balance <= 0) {
      throw new Error(
        "No Devnet SOL. Get test SOL before creating REKT."
      );
    }

    /*
     * First attempt.
     */

    let built = await buildCreateMintTransaction(
      mintKeypair
    );

    let signature;

    try {
      signature = await signSendAndConfirm(
        built.tx,
        built.latest
      );

    } catch (firstError) {
      const msg =
        firstError?.message ||
        String(firstError);

      console.warn(
        "First transaction attempt failed:",
        firstError
      );

      /*
       * Retry ONLY when the problem is an expired/
       * unknown blockhash.
       */

      if (
        msg.toLowerCase().includes("blockhash") ||
        msg.toLowerCase().includes("expired")
      ) {
        setStatus(
          "Blockhash expired. Preparing a fresh transaction..."
        );

        /*
         * IMPORTANT:
         * Build a completely fresh Transaction object.
         */

        built = await buildCreateMintTransaction(
          mintKeypair
        );

        signature = await signSendAndConfirm(
          built.tx,
          built.latest
        );

      } else {
        throw firstError;
      }
    }

    const mintAddress =
      mintKeypair.publicKey.toBase58();

    const explorerMint =
      `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`;

    const explorerTx =
      `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

    setStatus("100,000,000 REKT created on Devnet.");

    setResult(`
      <div style="
        margin-top:16px;
        padding:16px;
        border:1px solid #2ecc71;
        border-radius:14px;
        word-break:break-all;
      ">

        <strong>✅ REKT CREATED — DEVNET</strong>

        <br><br>

        <strong>Mint:</strong><br>
        ${mintAddress}

        <br><br>

        <strong>Supply:</strong><br>
        100,000,000 REKT

        <br><br>

        <strong>Decimals:</strong><br>
        6

        <br><br>

        <strong>Mint authority:</strong><br>
        REVOKED

        <br><br>

        <strong>Freeze authority:</strong><br>
        REVOKED

        <br><br>

        <a
          href="${explorerMint}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open REKT Mint in Solana Explorer
        </a>

        <br><br>

        <a
          href="${explorerTx}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open creation transaction
        </a>

      </div>
    `);

    await refreshBalance();

  } catch (err) {
    console.error("CREATE ERROR:", err);

    let message =
      err?.message ||
      String(err);

    /*
     * Some Solana errors contain extremely long
     * diagnostic text. Keep UI readable.
     */

    if (message.length > 700) {
      message =
        message.substring(0, 700) + "...";
    }

    setStatus(
      "Creation failed: " + message
    );

  } finally {
    creating = false;

    if (walletPublicKey) {
      createBtn.disabled = false;
    }
  }
}

/* ---------------- EVENTS ---------------- */

connectBtn?.addEventListener(
  "click",
  connectWallet
);

createBtn?.addEventListener(
  "click",
  createREKT
);

/* ---------------- PHANTOM EVENTS ---------------- */

const initialProvider = getProvider();

if (initialProvider) {
  provider = initialProvider;

  provider.on?.(
    "accountChanged",
    async (publicKey) => {
      if (publicKey) {
        walletPublicKey =
          new PublicKey(publicKey.toString());

        connectBtn.textContent =
          "Phantom connected";

        createBtn.disabled = false;

        await refreshBalance();

      } else {
        walletPublicKey = null;

        connectBtn.textContent =
          "Connect Phantom";

        createBtn.disabled = true;

        if (walletEl) {
          walletEl.textContent =
            "Wallet: not connected";
        }
      }
    }
  );
}

/* ---------------- AUTO CONNECT ---------------- */

(async () => {
  try {
    provider = getProvider();

    if (!provider) return;

    const response = await provider.connect({
      onlyIfTrusted: true,
    });

    if (!response?.publicKey) return;

    walletPublicKey =
      new PublicKey(
        response.publicKey.toString()
      );

    connectBtn.textContent =
      "Phantom connected";

    createBtn.disabled = false;

    setStatus("Phantom connected.");

    await refreshBalance();

  } catch {
    /*
     * Normal when the site has not yet been trusted.
     */
  }
})();