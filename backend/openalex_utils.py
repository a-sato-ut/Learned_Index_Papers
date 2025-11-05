# openalex_utils.py
from __future__ import annotations

import os
import time
import typing as t
import requests

OPENALEX_BASE = "https://api.openalex.org"
EMAIL = os.getenv("OPENALEX_EMAIL")  # OpenAlex APIのレート制限緩和のため

_DEFAULT_TIMEOUT = 30
_DELAY_BASE = 5
_MAX_RETRIES = 6
_BACKOFF_BASE = 1.8
_SESSION = requests.Session()

# OpenAlex APIのベストプラクティス: メールアドレスを指定するとレート制限が緩和される
_HEADERS = {"User-Agent": "openalex-client/1.0"}
if EMAIL:
    _HEADERS["From"] = EMAIL


def _request_json(
    method: str,
    url: str,
    *,
    params: dict | None = None,
    json: dict | None = None,
    timeout: int = _DEFAULT_TIMEOUT,
) -> dict:
    """requests + 冪等リトライ（429/5xx）。"""
    last_err = None
    for attempt in range(_MAX_RETRIES):
        try:
            resp = _SESSION.request(
                method, url, params=params, json=json, headers=_HEADERS, timeout=timeout
            )
            if resp.status_code == 200:
                return resp.json()
            # レート/一時障害はリトライ
            if resp.status_code in (429, 500, 502, 503, 504):
                delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
                time.sleep(delay)
                continue
            # それ以外のエラーはprintして空dictを返す
            print(f"OpenAlex API error {resp.status_code}: {resp.text}")
            return {}
        except requests.RequestException as e:
            # ネットワーク系もリトライ
            delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
            time.sleep(delay)
            last_err = e
    # リトライ尽きた
    raise RuntimeError(f"OpenAlex request failed after retries: {url}") from last_err


# ========== 1) 著者名から著者IDを検索 ==========
def get_author_id_by_name(name: str, *, top_k: int = 10) -> str | None:
    url = f"{OPENALEX_BASE}/authors"
    params = {
        "search": name,
        "per_page": max(1, min(200, top_k)),
    }
    data = _request_json("GET", url, params=params)
    
    results = data.get("results", []) or []
    if not results:
        return None
    
    # 完全一致（case-insensitive）を優先
    lower_name = name.strip().lower()
    for author in results:
        display_name = author.get("display_name", "")
        if display_name.strip().lower() == lower_name:
            return author.get("id").replace("https://openalex.org/", "")
    
    # 完全一致がなければ最上位候補
    if results:
        return results[0].get("id").replace("https://openalex.org/", "")
    
    return None


# ========== 2) 著者IDから著者情報（所属履歴含む）を取得 ==========
def get_author_info_by_id(author_id: str) -> dict:
    url = f"{OPENALEX_BASE}/authors/{author_id}"
    
    # 所属情報を含むフィールドを要求
    params = {}
    data = _request_json("GET", url, params=params)
    
    if not data:
        return {}
    
    # 所属情報を抽出
    affiliations_dict = {}
    affiliations_list = data.get("affiliations", []) or []
    
    for affiliation in affiliations_list:
        institution = affiliation.get("institution")
        if not institution:
            continue
        
        institution_name = institution.get("display_name", "")
        if not institution_name:
            continue
        
        # 開始年と終了年を取得
        years = affiliation.get("years", []) or []
        years = sorted(years)
        affiliations_dict[institution_name] = {
            "years": years,
        }

    # 所属情報をリストに変換
    affiliations = []
    for name, info in affiliations_dict.items():
        affiliations.append({
            "name": name,
            "years": info["years"],
        })
    # 最小年でソート（空の場合は最後に）
    affiliations.sort(key=lambda x: min(x["years"]) if x["years"] else float('inf'))
    return affiliations
