import os
import sys

import pytest

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)

from novapolis.generator import generate, preset_params  # noqa: E402
from novapolis.graph.digraph import DiGraph  # noqa: E402


@pytest.fixture(scope="session")
def mini():
    return generate(preset_params("mini"))


@pytest.fixture(scope="session")
def ville():
    return generate(preset_params("realiste"))


def digraph(n: int, arcs: list[tuple[int, int, float]]) -> DiGraph:
    g = DiGraph([f"V{i}" for i in range(n)])
    for k, (u, v, w) in enumerate(arcs):
        g.add_arc(u, v, w, k)
    return g
