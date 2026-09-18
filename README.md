# REKT v12 — Final Devnet Test
Order is intentionally enforced:
1. Create classic SPL Mint and mint exactly 100,000,000 REKT.
2. Create Metaplex metadata while Mint Authority still exists.
3. Only after metadata succeeds, revoke Mint Authority and Freeze Authority.
4. Read the Mint back from Devnet and verify supply, decimals, and both authorities.

If any step fails, later steps are not executed.
DEVNET ONLY.
