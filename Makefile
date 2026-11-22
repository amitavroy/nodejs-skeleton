.DEFAULT_GOAL := help
.PHONY: help up down stop restart logs ps psql

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-10s\033[0m %s\n", $$1, $$2}'

up: ## Start Postgres, Redis, Mailpit, pgAdmin and Dozzle (background)
	docker compose up -d --wait

down: ## Stop and remove containers (keeps data volumes)
	docker compose down

stop: ## Stop containers (keeps them and their data)
	docker compose stop

restart: ## Recreate one service, reloading .env: make restart s=postgres
	@test -n "$(s)" || (echo "Usage: make restart s=<service>  (postgres|redis|mailpit|pgadmin|dozzle)"; exit 1)
	docker compose up -d --force-recreate $(s)

logs: ## Follow logs: make logs [s=postgres]
	docker compose logs -f --tail 100 $(s)

ps: ## Show container status
	docker compose ps

psql: ## Open a psql shell in the database container
	docker compose exec postgres sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'
