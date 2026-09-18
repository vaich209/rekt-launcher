# REKT v13 — one-button Devnet flow
Both buttons are active on load. `Create Final REKT` itself requests Phantom connection if needed.
Flow: connect/sign -> create mint + 100M -> create metadata -> revoke mint/freeze -> verify.
DEVNET ONLY. Phantom approval/signatures are still required; a website cannot safely transact from the wallet without wallet authorization.
