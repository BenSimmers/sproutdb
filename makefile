PACKAGE = pnpm

# Targets
.PHONY: help build lint lint-fix test clean

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build       Build the project"
	@echo "  lint        Lint the project"
	@echo "  lint-fix    Fix linting issues"
	@echo "  test        Run tests"
	@echo "  clean       Clean the build artifacts"

build:
	@$(PACKAGE) run build

lint:
	@$(PACKAGE) run lint

lint-fix:
	@$(PACKAGE) run lint:fix

release:
	@$(PACKAGE) run release

test:
	@$(PACKAGE) run test

clean:
	@rm -rf dist --verbose