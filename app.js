import { createUmi } from "https://esm.sh/@metaplex-foundation/umi-bundle-defaults@1.4.1";
import { walletAdapterIdentity } from "https://esm.sh/@metaplex-foundation/umi-signer-wallet-adapters@1.4.1";
import { mplTokenMetadata, createV1, TokenStandard } from "https://esm.sh/@metaplex-foundation/mpl-token-metadata@3.4.0";
import { publicKey } from "https://esm.sh/@metaplex-foundation/umi@1.4.1";

const MINT="Ea8Yn1sQ6QrPYNREYPTbVYxVgkhUuiFqwyfY1K2oceUo";
const URI="https://vaich209.github.io/rekt-launcher/rekt.json?v=11";
const DAPP="https://vaich209.github.io/rekt-launcher/?v=11";
const connectBtn=document.getElementById("connectBtn"), metadataBtn=document.getElementById("metadataBtn");
const walletEl=document.getElementById("wallet"), statusEl=document.getElementById("status"), resultEl=document.getElementById("result");
let provider=null, umi=null;

const status=m=>statusEl.textContent=m;
function getPhantom(){return window.phantom?.solana?.isPhantom?window.phantom.solana:(window.solana?.isPhantom?window.solana:null)}
function openPhantom(){const u=encodeURIComponent(DAPP),r=encodeURIComponent(DAPP);location.href=`https://phantom.app/ul/browse/${u}?ref=${r}`}

async function connect(){
 provider=getPhantom();
 if(!provider){status("Opening Phantom...");openPhantom();return}
 try{
  const r=await provider.connect();
  walletEl.textContent="CONNECTED: "+r.publicKey.toString();
  connectBtn.textContent="Phantom connected";
  umi=createUmi("https://api.devnet.solana.com").use(mplTokenMetadata()).use(walletAdapterIdentity(provider));
  metadataBtn.disabled=false;
  status("Connected. Ready to add metadata to the existing Devnet Mint.");
 }catch(e){status("Connection error: "+(e?.message||String(e)))}
}

async function addMetadata(){
 if(!umi) return status("Connect Phantom first.");
 metadataBtn.disabled=true;
 try{
  status("Approve metadata transaction in Phantom...");
  const tx=await createV1(umi,{
    mint:publicKey(MINT),
    authority:umi.identity,
    payer:umi.identity,
    updateAuthority:umi.identity,
    name:"REKT",
    symbol:"REKT",
    uri:URI,
    sellerFeeBasisPoints:0,
    tokenStandard:TokenStandard.Fungible
  }).sendAndConfirm(umi);
  status("REKT metadata created on Devnet.");
  resultEl.innerHTML=`✅ Metadata added.<br><br><a target="_blank" rel="noopener noreferrer" href="https://explorer.solana.com/address/${MINT}?cluster=devnet">Open REKT in Explorer</a>`;
 }catch(e){
  console.error(e); status("Metadata failed: "+(e?.message||String(e)).slice(0,700)); metadataBtn.disabled=false;
 }
}
connectBtn.addEventListener("click",connect);
metadataBtn.addEventListener("click",addMetadata);
