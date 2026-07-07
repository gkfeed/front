.PHONY: update dev check test build

update:
	git pull --ff-only
	docker compose up -d --build

dev:
	npm run dev

check:
	NODE_OPTIONS=--disable-warning=ExperimentalWarning npm run check

test:
	NODE_OPTIONS=--disable-warning=ExperimentalWarning npm test

build:
	npm run build
