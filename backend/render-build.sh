#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Run migrations/seed (tables are created via conn.run_sync(Base.metadata.create_all) in seed.py)
python -m app.seed
