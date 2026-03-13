"""Configuration helpers for the answering notebook."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping


@dataclass(frozen=True)
class CollectionConfig:
    collection: str
    embedding_model: str


@dataclass(frozen=True)
class AnsweringConfig:
    vector_store_dir: Path
    sections: Dict[str, CollectionConfig]

    def ensure_vector_store(self) -> None:
        self.vector_store_dir.mkdir(parents=True, exist_ok=True)

    def section(self, name: str) -> CollectionConfig:
        try:
            return self.sections[name]
        except KeyError as exc:  # pragma: no cover – defensive guard
            raise KeyError(
                f"Unknown section '{name}'. Available: {sorted(self.sections.keys())}"
            ) from exc

    def section_names(self) -> list[str]:
        return sorted(self.sections.keys())


def _find_config_yaml() -> tuple[Path, Path]:
    """Locate config.yaml and return (config_path, root_dir).

    Search order:
      1. backend/config.yaml                          (simple — file lives next to code)
      2. ../agent_answering/config.yaml               (local dev monorepo)
    """
    here = Path(__file__).resolve().parent
    candidates = [
        here / "config.yaml",                          # backend/config.yaml
        here.parent / "agent_answering" / "config.yaml",  # local dev monorepo
    ]
    for path in candidates:
        if path.exists():
            return path, path.parent
    searched = "\n  ".join(str(c) for c in candidates)
    raise FileNotFoundError(
        f"Cannot find config.yaml. Searched:\n  {searched}"
    )


def _build_config() -> AnsweringConfig:
    config_path, root = _find_config_yaml()
    raw = _load_yaml(config_path)

    vector_store_dir = _resolve_path(root, raw.get("vector_store_dir", "vector_store"))

    sections_payload = raw.get("sections", {})
    sections = {
        name: _build_collection(entry, name)
        for name, entry in sections_payload.items()
    }
    if not sections:
        raise ValueError("At least one section must be defined in agent_answering/config.yaml")
    return AnsweringConfig(
        vector_store_dir=vector_store_dir,
        sections=sections,
    )


def _load_yaml(path: Path) -> Mapping[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing answering config: {path}")
    try:
        import yaml  # type: ignore
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise ModuleNotFoundError(
            "pyyaml is required to load agent_answering/config.yaml. Install it via `pip install pyyaml`."
        ) from exc

    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _build_collection(entry: Mapping[str, Any], name: str) -> CollectionConfig:
    collection = entry.get("collection") or f"smartlog_{name}"
    embedding_model = entry.get("embedding_model") or "sentence-transformers/all-MiniLM-L6-v2"
    return CollectionConfig(collection=str(collection), embedding_model=str(embedding_model))


def _resolve_path(root: Path, candidate: Any) -> Path:
    path = Path(candidate)
    if not path.is_absolute():
        path = (root / path).resolve()
    return path


CONFIG = _build_config()
__all__ = ["CONFIG", "AnsweringConfig", "CollectionConfig"]
