.PHONY: gen-abi test app-dev typecheck

# Always build contracts first so gen:abi reads fresh artifacts.
gen-abi:
	forge build --root contracts
	pnpm -C app gen:abi

test:
	forge test --root contracts

app-dev:
	pnpm -C app dev

typecheck:
	pnpm -C app typecheck
