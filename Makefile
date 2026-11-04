# Raccourcis : chaque cible appelle tasks.py (multiplateforme, utilisable sans make sous Windows).
PY ?= python

.PHONY: install data test bench figures api ui build demo

install data test bench figures api ui build demo:
	$(PY) tasks.py $@
