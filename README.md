# REKT v14 — startup fix
Critical fix: Metaplex/Umi modules are no longer imported during page startup.
This prevents a Metaplex CDN/import failure from killing the Connect Phantom event handlers.
The page must show: "v14 JavaScript loaded..." when app.js is executing.
Metaplex is loaded only at the metadata step, after wallet connection and mint creation.
DEVNET ONLY.
