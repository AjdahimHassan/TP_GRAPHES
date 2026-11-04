"""Lecture, validation et écriture des jeux de données CSV."""

from novapolis.io.reader import load_dataset, parse_texts, read_texts, tables_to_dataset
from novapolis.io.validator import ValidationReport, validate_tables
from novapolis.io.writer import dataset_hash, dataset_to_texts, folder_hash, write_dataset

__all__ = [
    "load_dataset",
    "parse_texts",
    "read_texts",
    "tables_to_dataset",
    "ValidationReport",
    "validate_tables",
    "dataset_hash",
    "dataset_to_texts",
    "folder_hash",
    "write_dataset",
]
