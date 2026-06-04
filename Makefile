.PHONY: gen-abi test app-dev typecheck subgraph-codegen subgraph-build subgraph-deploy

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

SUBGRAPH_SLUG ?= mend

# subgraph.yaml references contracts/out directly (graph-cli 0.98.1 unwraps Foundry artifacts).
# forge build first so the artifacts are fresh.
subgraph-codegen:
	forge build --root contracts
	pnpm -C subgraph codegen

subgraph-build: subgraph-codegen
	pnpm -C subgraph build

subgraph-deploy: subgraph-build
	pnpm -C subgraph exec graph deploy $(SUBGRAPH_SLUG)
