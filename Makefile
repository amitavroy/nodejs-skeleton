.DEFAULT_GOAL := help
.PHONY: help up down stop restart logs ps psql outdated update upgrade

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-10s\033[0m %s\n", $$1, $$2}'

up: ## Start Postgres, Redis, Mailpit and Dozzle (background)
	docker compose up -d --wait

down: ## Stop and remove containers (keeps data volumes)
	docker compose down

stop: ## Stop containers (keeps them and their data)
	docker compose stop

restart: ## Recreate one service, reloading .env: make restart s=postgres
	@test -n "$(s)" || (echo "Usage: make restart s=<service>  (postgres|redis|mailpit|dozzle)"; exit 1)
	docker compose up -d --force-recreate $(s)

logs: ## Follow logs: make logs [s=postgres]
	docker compose logs -f --tail 100 $(s)

ps: ## Show container status
	docker compose ps

psql: ## Open a psql shell in the database container
	docker compose exec postgres sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

outdated: ## Show outdated packages in the API and web app (Wanted = safe update, Latest = may be a major, breaking)
	-npm outdated --workspaces --include-workspace-root

update: ## Safe update: newest versions allowed by package.json ranges, then typecheck, test and build
	npm update --workspaces --include-workspace-root
	npm run typecheck
	npm test
	npm run build

upgrade: ## Upgrade ALL packages to latest, including major versions (may break), then typecheck, test and build
	npx --yes npm-check-updates --workspaces --root --upgrade
	npm install
	npm run typecheck
	npm test
	npm run build
