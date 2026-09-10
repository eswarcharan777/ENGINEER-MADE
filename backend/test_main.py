from fastapi.testclient import TestClient

from main import app, require_admin


client = TestClient(app)


def admin_claims():
    return {"uid": "test-admin", "admin": True}


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_paths_and_lesson_lookup():
    paths = client.get("/api/paths")
    assert paths.status_code == 200
    assert len(paths.json()["paths"]) == 15

    catalog = client.get("/api/catalog")
    assert catalog.status_code == 200
    assert len(catalog.json()["paths"][0]["modules"]) > 0


def test_admin_overview():
    app.dependency_overrides[require_admin] = admin_claims
    response = client.get("/api/admin/overview")
    assert response.status_code == 200
    assert response.json()["pathCount"] == 15
    assert response.json()["storage"] in {"memory", "firestore"}
    analytics = response.json()["learnerAnalytics"]
    assert {"available", "totalUsers", "activeUsers", "activeWindowMinutes", "users"} <= analytics.keys()

    lesson = client.get("/api/paths/ai-engineer/modules/ai-1/lessons/ai-1-1")
    assert lesson.status_code == 200
    assert lesson.json()["lesson"]["title"] == "Python Fundamentals & NumPy"
    app.dependency_overrides.clear()


def test_admin_users_requires_administrator_and_returns_safe_fields():
    assert client.get("/api/admin/users").status_code == 401
    app.dependency_overrides[require_admin] = admin_claims
    response = client.get("/api/admin/users")
    assert response.status_code == 200
    payload = response.json()
    assert {"available", "totalUsers", "activeUsers", "activeWindowMinutes", "users"} <= payload.keys()
    app.dependency_overrides.clear()


def test_admin_overview_requires_authentication():
    response = client.get("/api/admin/overview")
    assert response.status_code == 401


def test_platform_operations_are_private_and_public_announcements_are_safe():
    # The announcement feed is public, but empty without the server-side
    # Firestore connection used in development tests. All operations that can
    # expose learner data or mutate content require an administrator token.
    assert client.get("/api/announcements").status_code == 200
    assert client.post("/api/reports", json={"resourceUrl": "/paths", "issueType": "other"}).status_code == 401
    assert client.get("/api/admin/reports").status_code == 401
    assert client.get("/api/admin/audit-log").status_code == 401
    assert client.get("/api/admin/analytics").status_code == 401
    assert client.get("/api/admin/announcements").status_code == 401


def test_search_returns_navigable_lesson():
    response = client.get("/api/search", params={"q": "NumPy"})
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["pathId"] == "ai-engineer"
    assert result["moduleId"] == "ai-1"
    assert result["id"] == "ai-1-1"


def test_missing_content_returns_404():
    assert client.get("/api/paths/not-a-path").status_code == 404
    assert client.get("/api/paths/ai-engineer/modules/nope/lessons/nope").status_code == 404


def test_admin_lesson_changes_are_visible_through_public_catalog():
    app.dependency_overrides[require_admin] = admin_claims
    created = client.post(
        "/api/admin/paths/ai-engineer/modules/ai-1/lessons",
        json={"title": "Persistence test lesson", "type": "video", "videoId": "test-video"},
    )
    assert created.status_code == 201
    lesson = created.json()
    assert lesson["id"].startswith("ai-1-")

    fetched = client.get(f"/api/paths/ai-engineer/modules/ai-1/lessons/{lesson['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["lesson"]["title"] == "Persistence test lesson"

    removed = client.delete(
        f"/api/admin/paths/ai-engineer/modules/ai-1/lessons/{lesson['id']}"
    )
    assert removed.status_code == 200
    assert client.get(
        f"/api/paths/ai-engineer/modules/ai-1/lessons/{lesson['id']}"
    ).status_code == 404
    app.dependency_overrides.clear()


def test_admin_can_edit_and_draft_content_without_exposing_it_publicly():
    app.dependency_overrides[require_admin] = admin_claims
    drafted = client.patch(
        "/api/admin/paths/ai-engineer/modules/ai-1/lessons/ai-1-1",
        json={"title": "Private draft lesson", "status": "draft"},
    )
    assert drafted.status_code == 200
    assert drafted.json()["status"] == "draft"
    assert client.get("/api/paths/ai-engineer/modules/ai-1/lessons/ai-1-1").status_code == 404

    published = client.patch(
        "/api/admin/paths/ai-engineer/modules/ai-1/lessons/ai-1-1",
        json={"title": "Python Fundamentals & NumPy", "status": "published"},
    )
    assert published.status_code == 200
    assert client.get("/api/paths/ai-engineer/modules/ai-1/lessons/ai-1-1").status_code == 200
    assert client.patch("/api/admin/paths/ai-engineer", json={"status": "invalid"}).status_code == 422
    app.dependency_overrides.clear()


def test_role_assignment_requires_administrator():
    assert client.patch("/api/admin/users/a-user/role", json={"role": "admin"}).status_code == 401
