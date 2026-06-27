.PHONY: update dev

update:
	git pull --ff-only
	docker compose up -d --build

dev:
	npm run dev
