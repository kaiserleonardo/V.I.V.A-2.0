import os

import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def test_api_root():
    response = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}


def test_status_create_and_list():
    client_name = "TEST_viva_review"
    created = requests.post(
        f"{BASE_URL}/api/status", json={"client_name": client_name}, timeout=15
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload["client_name"] == client_name
    assert isinstance(payload["id"], str)

    listed = requests.get(f"{BASE_URL}/api/status", timeout=15)
    assert listed.status_code == 200
    assert any(item["id"] == payload["id"] for item in listed.json())