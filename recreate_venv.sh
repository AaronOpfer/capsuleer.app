#!/bin/bash -xe
source deactivate || true
rm -r .venv/
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip freeze -> pip-freeze.txt
