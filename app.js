import {Connection,PublicKey,Keypair,SystemProgram,Transaction,TransactionInstruction,clusterApiUrl,LAMPORTS_PER_SOL} from "https://esm.sh/@solana/web3.js@1.98.4";
import {TOKEN_PROGRAM_ID,MINT_SIZE,AuthorityType,getAssociatedTokenAddress,createInitializeMintInstruction,createAssociatedTokenAccountInstruction,createMintToInstruction,createSetAuthorityInstruction} from "https://esm.sh/@solana/spl-token@0.4.14";

const RPC=clusterApiUrl("devnet"), connection=new Connection(RPC,"confirmed");
const URI="https://vaich209.github.io/rekt-launcher/rekt.json?v=14";
const DAPP="https://vaich209.github.io/rekt-launcher/?v=14";
const RAW=100_000_000n*10n**6n;
const connectBtn=document.getElementById("connectBtn"),createBtn=document.getElementById("createBtn"),walletEl=document.getElementById("wallet"),statusEl=document.getElementById("status"),resultEl=document.getElementById("result");
let provider=null,owner=null,busy=false;
const status=x=>statusEl.textContent=x;
const phantom=()=>window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null);
function openPhantom(){const u=encodeURIComponent(DAPP),r=encodeURIComponent(DAPP);location.href=`https://phantom.app/ul/browse/${u}?ref=${r}`}
async function refresh(){const l=await connection.getBalance(owner,"confirmed");walletEl.innerHTML=`CONNECTED:<br>${owner.toBase58()}<br><br>Devnet balance: <strong>${(l/LAMPORTS_PER_SOL).toFixed(4)} SOL</strong>`}
async function connect(){provider=phantom();if(!provider){openPhantom();return}try{const r=await provider.connect();owner=new PublicKey(r.publicKey.toString());connectBtn.textContent="Phantom connected";createBtn.disabled=false;status("Connected. Ready for final Devnet test.");await refresh()}catch(e){status("Connection error: "+(e?.message||e))}}

async function walletSend(tx,extraSigner){
 const latest=await connection.getLatestBlockhash("processed");
 tx.feePayer=owner;tx.recentBlockhash=latest.blockhash;if(extraSigner)tx.partialSign(extraSigner);
 const signed=await provider.signTransaction(tx);
 const sig=await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,preflightCommitment:"processed",maxRetries:5});
 const c=await connection.confirmTransaction({signature:sig,blockhash:latest.blockhash,lastValidBlockHeight:latest.lastValidBlockHeight},"confirmed");
 if(c.value.err)throw new Error(JSON.stringify(c.value.err));return sig;
}
async function create(){
 if(busy)return;
 if(!provider||!owner){
   provider=phantom();
   if(!provider){ status("Opening Phantom..."); openPhantom(); return; }
   try{
     const r=await provider.connect();
     owner=new PublicKey(r.publicKey.toString());
     connectBtn.textContent="Phantom connected";
     await refresh();
   }catch(e){ status("Phantom connection required: "+(e?.message||String(e))); return; }
 }
 busy=true;createBtn.disabled=true;resultEl.innerHTML="";
 const mint=Keypair.generate();
 try{
  status("1/4 Creating Mint and minting exactly 100M REKT...");
  const rent=await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const ata=await getAssociatedTokenAddress(mint.publicKey,owner,false,TOKEN_PROGRAM_ID);
  let tx=new Transaction().add(
   SystemProgram.createAccount({fromPubkey:owner,newAccountPubkey:mint.publicKey,space:MINT_SIZE,lamports:rent,programId:TOKEN_PROGRAM_ID}),
   createInitializeMintInstruction(mint.publicKey,6,owner,owner,TOKEN_PROGRAM_ID),
   createAssociatedTokenAccountInstruction(owner,ata,owner,mint.publicKey,TOKEN_PROGRAM_ID),
   createMintToInstruction(mint.publicKey,ata,owner,RAW,[],TOKEN_PROGRAM_ID)
  );
  await walletSend(tx,mint);

  status("2/4 Creating Metaplex metadata while Mint Authority still exists...");
  const [{createUmi},{walletAdapterIdentity},{mplTokenMetadata,createV1,TokenStandard},{publicKey}] = await Promise.all([
    import("https://esm.sh/@metaplex-foundation/umi-bundle-defaults@1.4.1"),
    import("https://esm.sh/@metaplex-foundation/umi-signer-wallet-adapters@1.4.1"),
    import("https://esm.sh/@metaplex-foundation/mpl-token-metadata@3.4.0"),
    import("https://esm.sh/@metaplex-foundation/umi@1.4.1")
  ]);
  const umi=createUmi(RPC).use(mplTokenMetadata()).use(walletAdapterIdentity(provider));
  await createV1(umi,{mint:publicKey(mint.publicKey.toBase58()),authority:umi.identity,payer:umi.identity,updateAuthority:umi.identity,name:"REKT",symbol:"REKT",uri:URI,sellerFeeBasisPoints:0,tokenStandard:TokenStandard.Fungible}).sendAndConfirm(umi);

  status("3/4 Revoking Mint and Freeze authorities...");
  tx=new Transaction().add(
   createSetAuthorityInstruction(mint.publicKey,owner,AuthorityType.MintTokens,null,[],TOKEN_PROGRAM_ID),
   createSetAuthorityInstruction(mint.publicKey,owner,AuthorityType.FreezeAccount,null,[],TOKEN_PROGRAM_ID)
  );
  const sig=await walletSend(tx);

  status("4/4 Verifying on-chain Mint state...");
  const info=await connection.getParsedAccountInfo(mint.publicKey,"confirmed");
  const d=info.value?.data?.parsed?.info;
  if(!d)throw new Error("Could not verify Mint state.");
  if(d.mintAuthority!==null||d.freezeAuthority!==null)throw new Error("Authority verification failed.");
  if(d.decimals!==6)throw new Error("Decimals verification failed.");
  const amount=d.supply;
  if(amount!=="100000000000000")throw new Error("Supply verification failed: "+amount);

  const a=mint.publicKey.toBase58();
  status("FINAL REKT verified on Devnet.");
  resultEl.innerHTML=`<strong>✅ FINAL REKT — VERIFIED</strong><br><br><strong>Mint:</strong><br>${a}<br><br>Supply: 100,000,000 REKT<br>Decimals: 6<br>Metadata: CREATED<br>Mint Authority: REVOKED<br>Freeze Authority: REVOKED<br><br><a target="_blank" rel="noopener noreferrer" href="https://explorer.solana.com/address/${a}?cluster=devnet">Open in Solana Explorer</a>`;
  await refresh();
 }catch(e){console.error(e);status("STOPPED: "+(e?.message||String(e)).slice(0,900);resultEl.innerHTML="<strong>Nothing further was executed after the failed step.</strong>";}
 finally{busy=false;createBtn.disabled=false}
}
connectBtn.addEventListener("click",connect);createBtn.addEventListener("click",create);
status("v14 JavaScript loaded. Connect Phantom or press Create Final REKT.");
