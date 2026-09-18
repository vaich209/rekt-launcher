import {
  Connection, PublicKey, SystemProgram, Transaction, Keypair, clusterApiUrl
} from "https://esm.sh/@solana/web3.js@1.98.4";
import {
  TOKEN_PROGRAM_ID, MINT_SIZE, AuthorityType,
  createInitializeMintInstruction, createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress, createMintToInstruction, createSetAuthorityInstruction
} from "https://esm.sh/@solana/spl-token@0.4.14";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const connectBtn = document.querySelector("#connect");
const createBtn = document.querySelector("#create");
const walletEl = document.querySelector("#wallet");
const statusEl = document.querySelector("#status");

let provider, owner;

function getPhantom() {
  return window.phantom?.solana || window.solana;
}

connectBtn.onclick = async () => {
  try {
    provider = getPhantom();
    if (!provider?.isPhantom) {
      const here = location.href;
      location.href = "https://phantom.app/ul/browse/" +
        encodeURIComponent(here) + "?ref=" + encodeURIComponent(here);
      return;
    }
    const result = await provider.connect();
    owner = new PublicKey(result.publicKey.toString());
    walletEl.textContent = "Wallet: " + owner.toBase58();
    connectBtn.textContent = "Phantom connected";
    createBtn.disabled = false;
  } catch (e) {
    statusEl.textContent = "Connect failed: " + e.message;
  }
};

createBtn.onclick = async () => {
  try {
    createBtn.disabled = true;
    statusEl.textContent = "Preparing devnet token…";

    const mint = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const ata = await getAssociatedTokenAddress(mint.publicKey, owner);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMintInstruction(mint.publicKey, 6, owner, owner),
      createAssociatedTokenAccountInstruction(owner, ata, owner, mint.publicKey),
      createMintToInstruction(mint.publicKey, ata, owner, 100000000n * 1000000n),
      createSetAuthorityInstruction(mint.publicKey, owner, AuthorityType.MintTokens, null),
      createSetAuthorityInstruction(mint.publicKey, owner, AuthorityType.FreezeAccount, null)
    );

    tx.feePayer = owner;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(mint);

    const signed = await provider.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    const addr = mint.publicKey.toBase58();
    statusEl.innerHTML =
      "Created!<br>Mint: <b>" + addr + "</b><br>" +
      "<a target='_blank' rel='noopener' href='https://explorer.solana.com/address/" +
      addr + "?cluster=devnet'>Open in Solana Explorer</a>";
  } catch (e) {
    statusEl.textContent = "Creation failed: " + e.message;
  } finally {
    createBtn.disabled = false;
  }
};
