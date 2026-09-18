import {Connection,PublicKey,Keypair,SystemProgram,Transaction,clusterApiUrl,LAMPORTS_PER_SOL} from "https://esm.sh/@solana/web3.js@1.98.4";
import {TOKEN_PROGRAM_ID,MINT_SIZE,AuthorityType,getAssociatedTokenAddress,createInitializeMintInstruction,createAssociatedTokenAccountInstruction,createMintToInstruction,createSetAuthorityInstruction} from "https://esm.sh/@solana/spl-token@0.4.14";

const connectBtn=document.getElementById("connectBtn");
const createBtn=document.getElementById("createBtn");
const walletEl=document.getElementById("wallet");
const statusEl=document.getElementById("status");
const resultEl=document.getElementById("result");
const DAPP_URL="https://vaich209.github.io/rekt-launcher/";
const connection=new Connection(clusterApiUrl("devnet"),"confirmed");
const DECIMALS=6;
const RAW_SUPPLY=100_000_000n*10n**6n;
let provider=null,owner=null,creating=false;

function status(m){if(statusEl)statusEl.textContent=m}
function result(h=""){if(resultEl)resultEl.innerHTML=h}
function phantom(){return window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null)}
function openPhantom(){const u=encodeURIComponent(DAPP_URL),r=encodeURIComponent(DAPP_URL);location.href=`https://phantom.app/ul/browse/${u}?ref=${r}`}

async function balance(){
 if(!owner)return;
 const l=await connection.getBalance(owner,"confirmed");
 walletEl.innerHTML=`CONNECTED:<br>${owner.toBase58()}<br><br>Devnet balance: <strong>${(l/LAMPORTS_PER_SOL).toFixed(4)} SOL</strong>`;
}
async function connect(){
 provider=phantom();
 if(!provider){status("Opening launcher in Phantom...");openPhantom();return}
 try{
  status("Requesting Phantom connection...");
  const r=await provider.connect();
  owner=new PublicKey(r.publicKey.toString());
  connectBtn.textContent="Phantom connected";
  createBtn.disabled=false;
  status("Connected. DEVNET only.");
  await balance();
 }catch(e){status("Connection error: "+(e?.message||String(e)))}
}
async function build(mint){
 const rent=await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
 const ata=await getAssociatedTokenAddress(mint.publicKey,owner,false,TOKEN_PROGRAM_ID);
 const tx=new Transaction();
 tx.add(SystemProgram.createAccount({fromPubkey:owner,newAccountPubkey:mint.publicKey,space:MINT_SIZE,lamports:rent,programId:TOKEN_PROGRAM_ID}));
 tx.add(createInitializeMintInstruction(mint.publicKey,DECIMALS,owner,owner,TOKEN_PROGRAM_ID));
 tx.add(createAssociatedTokenAccountInstruction(owner,ata,owner,mint.publicKey,TOKEN_PROGRAM_ID));
 tx.add(createMintToInstruction(mint.publicKey,ata,owner,RAW_SUPPLY,[],TOKEN_PROGRAM_ID));
 tx.add(createSetAuthorityInstruction(mint.publicKey,owner,AuthorityType.MintTokens,null,[],TOKEN_PROGRAM_ID));
 tx.add(createSetAuthorityInstruction(mint.publicKey,owner,AuthorityType.FreezeAccount,null,[],TOKEN_PROGRAM_ID));
 const latest=await connection.getLatestBlockhash("processed");
 tx.feePayer=owner; tx.recentBlockhash=latest.blockhash; tx.partialSign(mint);
 return {tx,latest};
}
async function send(tx,latest){
 status("Approve the DEVNET transaction in Phantom...");
 const signed=await provider.signTransaction(tx);
 const height=await connection.getBlockHeight("processed");
 if(height>latest.lastValidBlockHeight)throw new Error("BLOCKHASH_EXPIRED_BEFORE_SEND");
 status("Sending to Solana Devnet...");
 const signature=await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,preflightCommitment:"processed",maxRetries:5});
 status("Confirming...");
 const c=await connection.confirmTransaction({signature,blockhash:latest.blockhash,lastValidBlockHeight:latest.lastValidBlockHeight},"confirmed");
 if(c.value.err)throw new Error("Transaction failed: "+JSON.stringify(c.value.err));
 return signature;
}
async function create(){
 if(creating)return;
 provider=phantom();
 if(!provider||!owner){status("Connect Phantom first.");return}
 creating=true;createBtn.disabled=true;result("");
 const mint=Keypair.generate();
 try{
  if(await connection.getBalance(owner,"confirmed")<=0)throw new Error("No Devnet SOL available.");
  let b=await build(mint),sig;
  try{sig=await send(b.tx,b.latest)}
  catch(e){
   const m=(e?.message||String(e)).toLowerCase();
   if(!m.includes("blockhash")&&!m.includes("expired"))throw e;
   status("Refreshing expired blockhash...");
   b=await build(mint);sig=await send(b.tx,b.latest);
  }
  const addr=mint.publicKey.toBase58();
  const a=`https://explorer.solana.com/address/${addr}?cluster=devnet`;
  const t=`https://explorer.solana.com/tx/${sig}?cluster=devnet`;
  status("100,000,000 REKT created on DEVNET.");
  result(`<div class="success"><strong>✅ REKT CREATED — DEVNET</strong><br><br><strong>Mint:</strong><br>${addr}<br><br><strong>Supply:</strong> 100,000,000 REKT<br><strong>Decimals:</strong> 6<br><strong>Mint authority:</strong> REVOKED<br><strong>Freeze authority:</strong> REVOKED<br><br><a href="${a}" target="_blank" rel="noopener noreferrer">Open Mint in Explorer</a><br><br><a href="${t}" target="_blank" rel="noopener noreferrer">Open transaction</a></div>`);
  await balance();
 }catch(e){console.error(e);status("Creation failed: "+(e?.message||String(e)).slice(0,700))}
 finally{creating=false;if(owner)createBtn.disabled=false}
}
connectBtn?.addEventListener("click",connect);
createBtn?.addEventListener("click",create);
createBtn.disabled=true;
status("Ready. Connect Phantom to continue.");