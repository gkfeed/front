.PHONY: update dev lan lan-ca lan-down check test build merge-to-master

BFF_PORT ?= 3100
BFF_TARGET ?= http://127.0.0.1:$(BFF_PORT)
FRONT_HOST ?= 0.0.0.0
FRONT_PORT ?= 4200

update:
	git pull --ff-only
	docker compose up -d --build

dev:
	BFF_PORT="$(BFF_PORT)" BFF_TARGET="$(BFF_TARGET)" FRONT_HOST="$(FRONT_HOST)" FRONT_PORT="$(FRONT_PORT)" npm run dev

lan:
	docker compose -f docker-compose.lan.yaml up -d --build

lan-ca:
	docker compose -f docker-compose.lan.yaml cp caddy:/data/caddy/pki/authorities/local/root.crt ./gkfeed-local-ca.crt

lan-down:
	docker compose -f docker-compose.lan.yaml down

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
