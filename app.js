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
   DEVNET ONLY
   ========================================================= */

const connection = new Connection(
  clusterApiUrl("devnet"),
  "confirmed"
);

const DECIMALS = 6;
const SUPPLY = 100_000_000n;
const RAW_SUPPLY =
  SUPPLY * 10n ** BigInt(DECIMALS);

const connectBtn =
  document.getElementById("connectBtn");

const createBtn =
  document.getElementById("createBtn");

const walletEl =
  document.getElementById("wallet");

const statusEl =
  document.getElementById("status");

const resultEl =
  document.getElementById("result");

let provider = null;
let owner = null;
let creating = false;


/* =========================================================
   UI
   ========================================================= */

function status(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function result(html = "") {
  if (resultEl) {
    resultEl.innerHTML = html;
  }
}


/* =========================================================
   PHANTOM
   ========================================================= */

function getPhantom() {

  if (
    window.phantom &&
    window.phantom.solana &&
    window.phantom.solana.isPhantom
  ) {
    return window.phantom.solana;
  }

  if (
    window.solana &&
    window.solana.isPhantom
  ) {
    return window.solana;
  }

  return null;
}


/* =========================================================
   OPEN SITE INSIDE PHANTOM
   ========================================================= */

function openInsidePhantom() {

  const here = window.location.href;

  const url =
    "https://phantom.app/ul/browse/" +
    encodeURIComponent(here) +
    "?ref=" +
    encodeURIComponent(here);

  window.location.href = url;
}


/* =========================================================
   BALANCE
   ========================================================= */

async function refreshBalance() {

  if (!owner) return;

  try {

    const lamports =
      await connection.getBalance(
        owner,
        "confirmed"
      );

    const sol =
      lamports / LAMPORTS_PER_SOL;

    if (walletEl) {

      walletEl.innerHTML =
        "Wallet:<br>" +
        owner.toBase58() +
        "<br><br>" +
        "Devnet balance: <strong>" +
        sol.toFixed(4) +
        " SOL</strong>";
    }

  } catch (e) {

    console.error(
      "Balance error:",
      e
    );
  }
}


/* =========================================================
   CONNECT
   ========================================================= */

async function connectWallet() {

  try {

    provider = getPhantom();

    /*
      Safari normally does not expose
      Phantom provider.

      Open the same page inside
      Phantom's browser.
    */

    if (!provider) {

      status(
        "Opening launcher inside Phantom..."
      );

      openInsidePhantom();

      return;
    }

    status(
      "Waiting for Phantom..."
    );

    /*
      Explicit user-triggered connection.
      No automatic wallet request.
    */

    const response =
      await provider.connect();

    owner = new PublicKey(
      response.publicKey.toString()
    );

    connectBtn.textContent =
      "Phantom connected";

    createBtn.disabled = false;

    status(
      "Phantom connected."
    );

    await refreshBalance();

  } catch (e) {

    console.error(
      "Connect error:",
      e
    );

    status(
      "Connection failed: " +
      (e?.message || String(e))
    );
  }
}


/* =========================================================
   BUILD FRESH TRANSACTION
   ========================================================= */

async function buildTransaction(
  mintKeypair
) {

  /*
    All expensive RPC preparation happens
    BEFORE requesting the blockhash.
  */

  const rent =
    await connection
      .getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

  const ata =
    await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      owner,
      false,
      TOKEN_PROGRAM_ID
    );

  const tx =
    new Transaction();

  /*
    1. Create mint account
  */

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey:
        mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId:
        TOKEN_PROGRAM_ID,
    })
  );


  /*
    2. Initialize mint

    Mint authority = wallet
    Freeze authority = wallet
    They are revoked below.
  */

  tx.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      owner,
      owner,
      TOKEN_PROGRAM_ID
    )
  );


  /*
    3. Create ATA
  */

  tx.add(
    createAssociatedTokenAccountInstruction(
      owner,
      ata,
      owner,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID
    )
  );


  /*
    4. Mint exactly 100M REKT
  */

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


  /*
    5. Permanently revoke
       additional minting.
  */

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


  /*
    6. Permanently revoke
       freeze authority.
  */

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
    CRITICAL FIX:

    Fetch blockhash LAST,
    immediately before Phantom signing.
  */

  const latest =
    await connection.getLatestBlockhash(
      "processed"
    );

  tx.feePayer = owner;

  tx.recentBlockhash =
    latest.blockhash;


  /*
    Mint account signs locally.

    This is NOT the Phantom private key.
  */

  tx.partialSign(
    mintKeypair
  );


  return {
    tx,
    latest,
    ata,
  };
}


/* =========================================================
   SIGN + SEND
   ========================================================= */

async function signAndSend(
  tx,
  latest
) {

  status(
    "Approve the Devnet transaction in Phantom..."
  );

  /*
    Explicit Phantom approval.
  */

  const signed =
    await provider.signTransaction(
      tx
    );


  /*
    Before broadcasting, check that
    this blockhash is still alive.
  */

  const height =
    await connection.getBlockHeight(
      "processed"
    );

  if (
    height >
    latest.lastValidBlockHeight
  ) {

    throw new Error(
      "BLOCKHASH_EXPIRED_BEFORE_SEND"
    );
  }


  status(
    "Sending to Solana Devnet..."
  );

  const signature =
    await connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: false,
        preflightCommitment:
          "processed",
        maxRetries: 5,
      }
    );


  status(
    "Confirming transaction..."
  );

  const confirmation =
    await connection.confirmTransaction(
      {
        signature,
        blockhash:
          latest.blockhash,
        lastValidBlockHeight:
          latest.lastValidBlockHeight,
      },
      "confirmed"
    );


  if (
    confirmation.value.err
  ) {

    throw new Error(
      "Transaction failed: " +
      JSON.stringify(
        confirmation.value.err
      )
    );
  }


  return signature;
}


/* =========================================================
   CREATE REKT
   ========================================================= */

async function createREKT() {

  if (creating) return;

  if (
    !provider ||
    !owner
  ) {

    status(
      "Connect Phantom first."
    );

    return;
  }


  creating = true;

  createBtn.disabled = true;

  result("");


  /*
    One mint address per creation attempt.
  */

  const mintKeypair =
    Keypair.generate();


  try {

    /*
      Verify Devnet balance.
    */

    const balance =
      await connection.getBalance(
        owner,
        "confirmed"
      );

    if (
      balance <= 0
    ) {

      throw new Error(
        "No Devnet SOL available."
      );
    }


    /*
      Build transaction with
      a fresh blockhash.
    */

    let built =
      await buildTransaction(
        mintKeypair
      );


    let signature;


    try {

      signature =
        await signAndSend(
          built.tx,
          built.latest
        );

    } catch (e) {

      const message =
        (
          e?.message ||
          String(e)
        ).toLowerCase();


      /*
        IMPORTANT:

        We do NOT silently send anything.

        If blockhash expired before broadcast,
        build a new transaction and Phantom
        will request approval again.
      */

      if (
        message.includes(
          "blockhash"
        ) ||
        message.includes(
          "expired"
        )
      ) {

        status(
          "Blockhash expired. Preparing a fresh Devnet transaction..."
        );


        built =
          await buildTransaction(
            mintKeypair
          );


        signature =
          await signAndSend(
            built.tx,
            built.latest
          );

      } else {

        throw e;
      }
    }


    const mint =
      mintKeypair.publicKey
        .toBase58();


    const mintExplorer =
      "https://explorer.solana.com/address/" +
      mint +
      "?cluster=devnet";


    const txExplorer =
      "https://explorer.solana.com/tx/" +
      signature +
      "?cluster=devnet";


    status(
      "100,000,000 REKT created on Devnet."
    );


    result(`
      <div style="
        margin-top:16px;
        padding:16px;
        border:1px solid #2ecc71;
        border-radius:14px;
        word-break:break-all;
      ">

        <strong>
          ✅ REKT CREATED — DEVNET
        </strong>

        <br><br>

        <strong>Mint address:</strong>
        <br>
        ${mint}

        <br><br>

        <strong>Supply:</strong>
        <br>
        100,000,000 REKT

        <br><br>

        <strong>Decimals:</strong>
        <br>
        6

        <br><br>

        <strong>Mint authority:</strong>
        <br>
        REVOKED

        <br><br>

        <strong>Freeze authority:</strong>
        <br>
        REVOKED

        <br><br>

        <a
          href="${mintExplorer}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open REKT Mint
        </a>

        <br><br>

        <a
          href="${txExplorer}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open transaction
        </a>

      </div>
    `);


    await refreshBalance();


  } catch (e) {

    console.error(
      "REKT creation error:",
      e
    );


    let message =
      e?.message ||
      String(e);


    if (
      message.length > 600
    ) {

      message =
        message.slice(
          0,
          600
        ) +
        "...";
    }


    status(
      "Creation failed: " +
      message
    );

  } finally {

    creating = false;


    if (owner) {

      createBtn.disabled =
        false;
    }
  }
}


/* =========================================================
   BUTTONS
   ========================================================= */

if (connectBtn) {

  connectBtn.onclick =
    connectWallet;
}


if (createBtn) {

  createBtn.onclick =
    createREKT;
}


/* =========================================================
   WALLET ACCOUNT CHANGE
   ========================================================= */

const detected =
  getPhantom();


if (detected) {

  provider = detected;


  provider.on?.(
    "accountChanged",
    async publicKey => {

      if (publicKey) {

        owner =
          new PublicKey(
            publicKey.toString()
          );

        connectBtn.textContent =
          "Phantom connected";

        createBtn.disabled =
          false;

        status(
          "Phantom connected."
        );

        await refreshBalance();

      } else {

        owner = null;

        connectBtn.textContent =
          "Connect Phantom";

        createBtn.disabled =
          true;

        if (walletEl) {

          walletEl.textContent =
            "Wallet: not connected";
        }

        status(
          "Wallet disconnected."
        );
      }
    }
  );
}


/*
  IMPORTANT:

  No provider.connect() here.

  Phantom is contacted ONLY after the
  user explicitly presses Connect Phantom.
*/

createBtn.disabled = true;