# UV Setup Guide

This project uses [uv](https://github.com/astral-sh/uv) - an extremely fast Python package installer and resolver written in Rust.

## Why UV?

- **10-100x faster** than pip
- **Automatic dependency resolution** with better conflict handling
- **Built-in virtual environment management**
- **Compatible with pip** and existing tools
- **No configuration needed** - works out of the box

## Installation

### Install UV

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv

# Or with pip
pip install uv
```

Verify installation:
```bash
uv --version
# uv 0.5.26 or later
```

## Quick Start

### 1. Create Virtual Environment

```bash
cd api
uv venv
```

This creates a `.venv` directory with your Python environment.

### 2. Activate Virtual Environment

```bash
# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

### 3. Install Dependencies

```bash
# From requirements.txt
uv pip install -r requirements.txt

# Or from pyproject.toml
uv pip install -e .

# With dev dependencies
uv pip install -e ".[dev]"
```

### 4. Run the Server

```bash
# Option 1: With activated venv
python run.py

# Option 2: Direct with uv (no activation needed)
uv run python run.py

# Option 3: Using uvicorn directly
uv run uvicorn app.main:app --reload
```

## Common Commands

### Package Management

```bash
# Install a package
uv pip install package-name

# Install specific version
uv pip install package-name==1.0.0

# Uninstall a package
uv pip uninstall package-name

# List installed packages
uv pip list

# Show outdated packages
uv pip list --outdated

# Upgrade a package
uv pip install --upgrade package-name

# Freeze dependencies
uv pip freeze > requirements.txt
```

### Virtual Environment

```bash
# Create venv with specific Python version
uv venv --python 3.13

# Create venv in custom location
uv venv path/to/venv

# Remove venv
rm -rf .venv
```

### Running Commands

```bash
# Run Python script (no activation needed)
uv run python script.py

# Run with specific Python version
uv run --python 3.13 python script.py

# Run a command in the venv
uv run command args
```

## Project Structure

```
api/
├── .venv/                  # Virtual environment (created by uv)
├── .python-version         # Python version specification
├── pyproject.toml          # Project metadata and dependencies
├── requirements.txt        # Pinned dependencies (fallback)
├── run.py                  # Server runner
└── ...
```

## Development Workflow

### Initial Setup

```bash
# 1. Clone/navigate to project
cd api

# 2. Create venv
uv venv

# 3. Install dependencies
uv pip install -r requirements.txt

# 4. Copy and configure .env
cp .env.example .env
# Edit .env with your API keys

# 5. Run server
uv run python run.py
```

### Daily Development

```bash
# Activate venv (once per terminal session)
source .venv/bin/activate

# Run server with auto-reload
python run.py

# Or without activation
uv run python run.py
```

### Adding Dependencies

```bash
# Install new package
uv pip install new-package

# Update requirements.txt
uv pip freeze > requirements.txt

# Or add to pyproject.toml dependencies
# Then sync
uv pip install -e .
```

## Advantages Over pip

### Speed Comparison

| Operation | pip | uv | Speedup |
|-----------|-----|-----|---------|
| Install 50 packages | 45s | 2s | **22.5x** |
| Resolve dependencies | 30s | 0.3s | **100x** |
| Create venv | 5s | 0.5s | **10x** |

### Better Dependency Resolution

UV uses a **SAT solver** for dependency resolution:
- Finds conflicts faster
- Better error messages
- More predictable results
- Handles complex dependency trees

### Example

```bash
# pip might fail with conflicts
pip install package-a package-b
# ERROR: Cannot install package-a and package-b because...

# uv resolves automatically
uv pip install package-a package-b
# Resolved 50 packages in 0.5s
# ✓ Success
```

## Compatibility

UV is **100% compatible** with:
- pip
- virtualenv
- requirements.txt
- pyproject.toml
- setup.py
- Existing Python tools

You can use `uv pip` anywhere you'd use `pip`.

## Troubleshooting

### "uv: command not found"

**Solution**: Install uv
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Add to PATH (if needed):
```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Python version issues

**Check available Python versions**:
```bash
uv python list
```

**Install specific Python version**:
```bash
uv python install 3.13
```

**Use specific version**:
```bash
uv venv --python 3.13
```

### Dependencies not found

**Sync environment**:
```bash
uv pip install -r requirements.txt --force-reinstall
```

### Port already in use

```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
API_PORT=8001 uv run python run.py
```

## Migration from pip/venv

If you have an existing `venv` setup:

```bash
# 1. Export current dependencies
pip freeze > requirements-old.txt

# 2. Remove old venv
rm -rf venv/

# 3. Create uv venv
uv venv

# 4. Install from old requirements
uv pip install -r requirements-old.txt

# 5. Update requirements.txt
uv pip freeze > requirements.txt

# 6. Test
uv run python run.py
```

## CI/CD with UV

### GitHub Actions

```yaml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        run: curl -LsSf https://astral.sh/uv/install.sh | sh

      - name: Install dependencies
        run: uv pip install -r requirements.txt

      - name: Run tests
        run: uv run pytest
```

### Docker

```dockerfile
FROM python:3.13-slim

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY requirements.txt .

# Install deps with uv
RUN uv pip install --system -r requirements.txt

COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

## VS Code Integration

Add to `.vscode/settings.json`:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/api/.venv/bin/python",
  "python.terminal.activateEnvironment": true,
  "python.languageServer": "Pylance"
}
```

## Performance Tips

### Cache UV downloads

UV automatically caches packages in `~/.cache/uv`

### Parallel installs

UV automatically parallelizes package downloads and installations.

### Lock files (upcoming)

UV will support lockfiles for reproducible installs:
```bash
uv pip compile requirements.in -o requirements.txt
uv pip sync requirements.txt
```

## Resources

- [UV Documentation](https://github.com/astral-sh/uv)
- [UV vs pip benchmarks](https://github.com/astral-sh/uv#benchmarks)
- [Astral (UV creators)](https://astral.sh)

## Need Help?

- Check [UV GitHub Issues](https://github.com/astral-sh/uv/issues)
- Read the [User Guide](https://github.com/astral-sh/uv/blob/main/README.md)
- Ask in [Discord](https://discord.gg/astral-sh)

---

**TL;DR**: Use `uv pip` instead of `pip` and enjoy 10-100x speedup! 🚀
