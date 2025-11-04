# semantic_scholar_utils.py
from __future__ import annotations

import os
import time
import math
import typing as t
import requests

S2_BASE = "https://api.semanticscholar.org/graph/v1"
API_KEY = os.getenv("SEMANTIC_SCHOLAR_API_KEY")

_DEFAULT_TIMEOUT = 30
_DELAY_BASE = 5
_MAX_RETRIES = 6
_BACKOFF_BASE = 1.8
_SESSION = requests.Session()
_HEADERS = {"User-Agent": "s2-client/1.0"}
if API_KEY:
    _HEADERS_WITH_KEY = {**_HEADERS, "x-api-key": API_KEY}
else:
    _HEADERS_WITH_KEY = dict(_HEADERS)


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
                method, url, params=params, json=json, headers=_HEADERS_WITH_KEY, timeout=timeout
            )
            if resp.status_code == 200:
                return resp.json()
            # レート/一時障害はリトライ
            if resp.status_code in (429, 500, 502, 503, 504):
                delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
                time.sleep(delay)
                continue
            # それ以外のエラーは詳細を出す
            raise RuntimeError(f"S2 API error {resp.status_code}: {resp.text}")
        except requests.RequestException as e:
            # ネットワーク系もリトライ
            delay = (_BACKOFF_BASE ** attempt) + (_DELAY_BASE * attempt)
            time.sleep(delay)
            last_err = e
    # リトライ尽きた
    raise RuntimeError(f"S2 request failed after retries: {url}") from last_err


# ========== 1) タイトル→paperId ==========
def get_paper_id_by_title(title: str, *, year: int | None = None, top_k: int = 10) -> str | None:
    """
    タイトル文字列からSemantic Scholarの paperId を返す。
    - まず /paper/search で top_k 件を取得
    - 完全一致(大小無視)を優先、だめなら1位の候補を返す
    - 見つからなければ None
    """
    url = f"{S2_BASE}/paper/search"
    params = {
        "query": title,
        "limit": max(1, min(100, top_k)),
        # ネストは不可なので、authors.name 等は要求しない
        "fields": "paperId,title,year,venue,externalIds",
    }
    data = _request_json("GET", url, params=params)
    results = data.get("data", []) or []
    if not results:
        return None

    # 年が指定されていれば軽く優先
    if year is not None:
        cand_year = [p for p in results if p.get("year") == year]
    else:
        cand_year = results

    # 完全一致（case-insensitive）を優先
    lower_title = title.strip().lower()
    for p in cand_year:
        if (p.get("title") or "").strip().lower() == lower_title:
            return p.get("paperId")

    # 年がズレていても、完全一致があればそれを返す
    for p in results:
        if (p.get("title") or "").strip().lower() == lower_title:
            return p.get("paperId")

    # それも無ければ最上位候補
    return results[0].get("paperId")


# ========== 2) paperId → その論文を引用する全paperId ==========
def list_citing_paper_ids(
    paper_id: str,
    *,
    per_page: int = 100,
    max_results: int | None = None,
) -> list[str]:
    """
    /paper/{id}/citations をページングで最後まで走査し、citingPaper.paperId を全回収。
    - per_page: 1ページの件数（100〜200程度が安全）
    - max_results: 取得上限（None=無制限）
    """
    per_page = max(1, min(1000, per_page))
    url = f"{S2_BASE}/paper/{paper_id}/citations"
    fields = "citingPaper.paperId"  # 軽量にIDのみ

    out: list[str] = []
    offset = 0
    while True:
        params = {"limit": per_page, "offset": offset, "fields": fields}
        data = _request_json("GET", url, params=params)
        items = data.get("data", []) or []
        for it in items:
            cp = it.get("citingPaper") or {}
            pid = cp.get("paperId")
            if pid:
                out.append(pid)
                if max_results is not None and len(out) >= max_results:
                    return out
        next_offset = data.get("next", None)
        if next_offset is None:
            break
        offset = next_offset
    return out


# ========== 3) paperId → その論文のメタ情報（被引用/参考文献は含めない） ==========
def get_paper_metadata(paper_id: str) -> dict:
    """
    /paper/{id} でメタ情報を取得し、使いやすい形に整形して返す。
    返すdictの例:
    {
      "paperId": "...",
      "title": "...",
      "year": 2025,
      "venue": "Proc. VLDB Endow.",
      "authors": ["First A.", "Second B.", ...],
      "doi": "10.xxxx/...",
      "arxivId": "xxxx.xxxxx",
      "url": "https://www.semanticscholar.org/paper/...",
      "isOpenAccess": true/false,
      "openAccessPdf": "https://...",
      "publicationTypes": ["JournalArticle", "Conference", ...]  # あれば
      "s2FieldsOfStudy": ["Computer Science", ...],              # あれば
      "abstract": "...",
      "citationCount": 123,
      "referenceCount": 45
    }
    """
    url = f"{S2_BASE}/paper/{paper_id}"
    # ネストのサブフィールド指定は禁止なので、オブジェクト/配列単位で要求
    fields = ",".join([
        "paperId",
        "title",
        "year",
        "venue",
        "authors",
        "externalIds",
        "url",
        "isOpenAccess",
        "openAccessPdf",
        "publicationVenue",
        "journal",
        "publicationTypes",
        "s2FieldsOfStudy",
        "abstract",
        "citationCount",
        "referenceCount",
    ])
    data = _request_json("GET", url, params={"fields": fields})

    ext = data.get("externalIds") or {}
    doi = ext.get("DOI")
    arxiv_id = ext.get("ArXiv")

    # authors は配列のまま返るので、名前だけ取り出す
    authors = [a.get("name") for a in (data.get("authors") or []) if a.get("name")]

    # openAccessPdf は {url: "..."} のことが多い
    oapdf = data.get("openAccessPdf") or {}
    oapdf_url = oapdf.get("url")

    # venueは文字列、publicationVenue/journalはオブジェクト。代表値を venue_str に寄せる
    venue_str = data.get("venue")
    if not venue_str:
        pv = data.get("publicationVenue") or {}
        if pv.get("name"):
            venue_str = pv["name"]
    if not venue_str:
        j = data.get("journal") or {}
        if j.get("name"):
            venue_str = j["name"]

    return {
        "paperId": data.get("paperId"),
        "title": data.get("title"),
        "year": data.get("year"),
        "venue": venue_str,
        "authors": authors,
        "doi": doi,
        "arxivId": arxiv_id,
        "url": data.get("url"),
        "isOpenAccess": data.get("isOpenAccess"),
        "openAccessPdf": oapdf_url,
        "publicationTypes": data.get("publicationTypes"),
        "s2FieldsOfStudy": data.get("s2FieldsOfStudy"),
        "abstract": data.get("abstract"),
        "citationCount": data.get("citationCount"),
        "referenceCount": data.get("referenceCount"),
    }
