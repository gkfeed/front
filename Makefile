.PHONY: update dev check test build merge-to-master

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

merge-to-master:
	git push
	git checkout master
	git merge dev
	git push
	git checkout dev
