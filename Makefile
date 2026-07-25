.PHONY: update dev check test build merge-to-master

BFF_PORT ?= 3100
BFF_TARGET ?= http://127.0.0.1:$(BFF_PORT)

update:
	git pull --ff-only
	docker compose up -d --build

dev:
	@set -e; \
	PORT="$(BFF_PORT)" npm run dev:bff & \
	bff_pid=$$!; \
	trap 'kill "$$bff_pid" 2>/dev/null || true; wait "$$bff_pid" 2>/dev/null || true' EXIT INT TERM; \
	BFF_TARGET="$(BFF_TARGET)" npm run dev

check:
	NODE_OPTIONS=--disable-warning=ExperimentalWarning npm run check

test:
	NODE_OPTIONS=--disable-warning=ExperimentalWarning npm test

build:
	npm run build

merge-to-master:
	git push
	git checkout master
	git merge dev
	git push
	git checkout dev
