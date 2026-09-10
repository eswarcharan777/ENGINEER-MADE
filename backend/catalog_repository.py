"""Firestore-backed learning catalog with a zero-config local fallback."""

from __future__ import annotations

from copy import deepcopy
import json
import os
from threading import RLock
from typing import Any
from uuid import uuid4


Catalog = dict[str, dict[str, Any]]


class CatalogRepository:
    """Storage boundary for paths, modules, and lessons."""

    def __init__(self, defaults: Catalog, firestore_client: Any | None = None):
        self._defaults = deepcopy(defaults)
        self._memory = deepcopy(defaults)
        self._db = firestore_client
        self._lock = RLock()
        self.storage_mode = "firestore" if firestore_client is not None else "memory"

    @property
    def _collection(self):
        # Keep the server-side repository aligned with firestore.rules and the
        # public catalog collection name.
        return self._db.collection("learningPaths")

    def _ensure_seeded(self) -> None:
        if self._db is None:
            return
        # Existing cloud data is authoritative. Defaults are written only for
        # a completely new Firebase project and never overwrite admin edits.
        if next(iter(self._collection.limit(1).stream()), None) is not None:
            return
        batch = self._db.batch()
        for path_id, path in self._defaults.items():
            batch.set(self._collection.document(path_id), deepcopy(path))
        batch.commit()

    def all_paths(self) -> Catalog:
        if self._db is None:
            with self._lock:
                return deepcopy(self._memory)
        self._ensure_seeded()
        cloud_paths = {snapshot.id: snapshot.to_dict() for snapshot in self._collection.stream()}
        # Firestore does not guarantee the original insertion order. Retain the
        # curated homepage order, followed by any future admin-created paths.
        ordered_ids = [path_id for path_id in self._defaults if path_id in cloud_paths]
        ordered_ids.extend(sorted(set(cloud_paths) - set(ordered_ids)))
        return {path_id: cloud_paths[path_id] for path_id in ordered_ids}

    def get_path(self, path_id: str) -> dict[str, Any] | None:
        if self._db is None:
            with self._lock:
                path = self._memory.get(path_id)
                return deepcopy(path) if path else None
        self._ensure_seeded()
        snapshot = self._collection.document(path_id).get()
        return snapshot.to_dict() if snapshot.exists else None

    def update_path(self, path_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        """Update the editable path fields without allowing IDs to be replaced."""
        allowed = {"title", "description", "icon", "color", "skills", "duration", "status"}
        clean = {key: deepcopy(value) for key, value in changes.items() if key in allowed}
        if not clean:
            raise ValueError("No editable path fields were supplied")
        if self._db is None:
            with self._lock:
                path = self._memory.get(path_id)
                if path is None:
                    raise KeyError("path")
                path.update(clean)
                return deepcopy(path)
        self._ensure_seeded()
        reference = self._collection.document(path_id)
        if not reference.get().exists:
            raise KeyError("path")
        reference.update(clean)
        return self.get_path(path_id) or {}

    def update_module(self, path_id: str, module_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        allowed = {"title", "description", "status"}
        clean = {key: deepcopy(value) for key, value in changes.items() if key in allowed}
        if not clean:
            raise ValueError("No editable module fields were supplied")
        return self._mutate_module(path_id, module_id, lambda module: module.update(clean))

    def update_lesson(self, path_id: str, module_id: str, lesson_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        allowed = {"title", "type", "videoId", "externalUrl", "audioUrl", "duration", "status"}
        clean = {key: deepcopy(value) for key, value in changes.items() if key in allowed}
        if not clean:
            raise ValueError("No editable lesson fields were supplied")

        found: dict[str, Any] = {}
        def mutate(module: dict[str, Any]) -> None:
            lesson = next((item for item in module.get("lessons", []) if item["id"] == lesson_id), None)
            if lesson is None:
                raise KeyError("lesson")
            lesson.update(clean)
            found.update(deepcopy(lesson))
        self._mutate_module(path_id, module_id, mutate)
        return found

    def _mutate_module(self, path_id: str, module_id: str, mutator: Any) -> dict[str, Any]:
        """Atomically update one embedded module in memory or Firestore."""
        if self._db is None:
            with self._lock:
                path = self._memory.get(path_id)
                if path is None:
                    raise KeyError("path")
                module = next((item for item in path["modules"] if item["id"] == module_id), None)
                if module is None:
                    raise KeyError("module")
                mutator(module)
                return deepcopy(module)
        self._ensure_seeded()
        from google.cloud import firestore as google_firestore
        reference = self._collection.document(path_id)
        transaction = self._db.transaction()
        result: dict[str, Any] = {}

        @google_firestore.transactional
        def persist(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError("path")
            path = snapshot.to_dict()
            module = next((item for item in path["modules"] if item["id"] == module_id), None)
            if module is None:
                raise KeyError("module")
            mutator(module)
            result.update(deepcopy(module))
            transaction.update(reference, {"modules": path["modules"]})
        persist(transaction)
        return result

    def create_lesson(self, path_id: str, module_id: str, lesson: dict[str, Any]) -> dict[str, Any]:
        new_lesson = {"id": f"{module_id}-{uuid4().hex[:10]}", **deepcopy(lesson)}
        if self._db is None:
            with self._lock:
                path = self._memory.get(path_id)
                if path is None:
                    raise KeyError("path")
                module = next((item for item in path["modules"] if item["id"] == module_id), None)
                if module is None:
                    raise KeyError("module")
                module["lessons"].append(new_lesson)
            return deepcopy(new_lesson)

        self._ensure_seeded()
        from google.cloud import firestore as google_firestore

        reference = self._collection.document(path_id)
        transaction = self._db.transaction()

        @google_firestore.transactional
        def persist(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError("path")
            path = snapshot.to_dict()
            module = next((item for item in path["modules"] if item["id"] == module_id), None)
            if module is None:
                raise KeyError("module")
            module["lessons"].append(new_lesson)
            transaction.update(reference, {"modules": path["modules"]})

        persist(transaction)
        return deepcopy(new_lesson)

    def delete_lesson(self, path_id: str, module_id: str, lesson_id: str) -> None:
        if self._db is None:
            with self._lock:
                path = self._memory.get(path_id)
                if path is None:
                    raise KeyError("path")
                module = next((item for item in path["modules"] if item["id"] == module_id), None)
                if module is None:
                    raise KeyError("module")
                remaining = [item for item in module["lessons"] if item["id"] != lesson_id]
                if len(remaining) == len(module["lessons"]):
                    raise KeyError("lesson")
                module["lessons"] = remaining
            return

        self._ensure_seeded()
        from google.cloud import firestore as google_firestore

        reference = self._collection.document(path_id)
        transaction = self._db.transaction()

        @google_firestore.transactional
        def persist(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists:
                raise KeyError("path")
            path = snapshot.to_dict()
            module = next((item for item in path["modules"] if item["id"] == module_id), None)
            if module is None:
                raise KeyError("module")
            remaining = [item for item in module["lessons"] if item["id"] != lesson_id]
            if len(remaining) == len(module["lessons"]):
                raise KeyError("lesson")
            module["lessons"] = remaining
            transaction.update(reference, {"modules": path["modules"]})

        persist(transaction)


def create_firestore_client() -> Any | None:
    """Return a client only when server-side Firebase config is explicit."""

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
    has_adc = bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    has_emulator = bool(os.getenv("FIRESTORE_EMULATOR_HOST"))
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        return None

    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        if service_account_json:
            # An explicitly configured but invalid credential must stop startup;
            # silently falling back would make production writes ephemeral.
            firebase_app = firebase_admin.initialize_app(
                credentials.Certificate(json.loads(service_account_json))
            )
        elif project_id and (has_adc or has_emulator):
            firebase_app = firebase_admin.initialize_app(options={"projectId": project_id})
        else:
            return None
    return firestore.client(app=firebase_app)
