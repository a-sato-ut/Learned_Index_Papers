"""
データ整形モジュール
収集した論文データをフロントエンド用に整形し、citation networkを構築します
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# データフォルダのパス
PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
CITATIONS_FOLDER = Path(__file__).parent.parent / "data" / "citations"
PROCESSED_DATA_FOLDER = Path(__file__).parent.parent / "processed_data"

app = FastAPI(title="Learned Index Papers API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Paper(BaseModel):
    paperId: str
    title: str
    year: Optional[int] = None
    venue: Optional[str] = None
    authors: List[str] = []
    doi: Optional[str] = None
    arxivId: Optional[str] = None
    url: Optional[str] = None
    isOpenAccess: bool = False
    openAccessPdf: Optional[str] = None
    abstract: Optional[str] = None
    citationCount: int = 0
    referenceCount: int = 0


class CitationInfo(BaseModel):
    paperId: str
    citationPaperIds: List[str] = []


class Corpus:
    """論文コーパスと引用関係を管理するクラス"""

    def __init__(self):
        self.papers: Dict[str, Paper] = {}
        self.cited_by: Dict[str, List[str]] = {}  # paperId -> [引用している論文IDのリスト]
        self.cites: Dict[str, List[str]] = {}  # paperId -> [引用されている論文IDのリスト]
        self._load_data()

    def _load_data(self):
        """データを読み込む"""
        # 論文データを読み込む
        for paper_file in PAPERS_FOLDER.glob("*.json"):
            try:
                with open(paper_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    paper = Paper(**data)
                    self.papers[paper.paperId] = paper
            except Exception as e:
                print(f"Error loading paper {paper_file}: {e}")

        # 引用データを読み込む
        # citations/{paperId}.json の citationPaperIds は、その paperId を引用している（cited by）論文のリスト
        for citation_file in CITATIONS_FOLDER.glob("*.json"):
            try:
                with open(citation_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    paper_id = data["paperId"]
                    citation_ids = data.get("citationPaperIds", [])

                    # cited_by を構築（この論文を引用している論文）
                    # citation_ids は paper_id を引用している論文のリスト
                    self.cited_by[paper_id] = citation_ids

                    # cites を構築（この論文が引用している論文）
                    # citation_ids の各論文が paper_id を引用しているということは、
                    # 逆方向では、citation_ids の各論文が paper_id を引用している
                    # つまり、cites[citation_id] に paper_id を追加
                    for citation_id in citation_ids:
                        if citation_id not in self.cites:
                            self.cites[citation_id] = []
                        if paper_id not in self.cites[citation_id]:
                            self.cites[citation_id].append(paper_id)
            except Exception as e:
                print(f"Error loading citation {citation_file}: {e}")

        print(f"Loaded {len(self.papers)} papers")

    def _lcs_length(self, s1: str, s2: str) -> int:
        """最長共通部分列（LCS）の長さを計算（連続しない文字列を許す）"""
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1].lower() == s2[j - 1].lower():
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

        return dp[m][n]

    def _lcss_length(self, s1: str, s2: str) -> int:
        """最長共通部分文字列（LCSS）の長さを計算（連続する部分のみ）"""
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        max_length = 0

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1].lower() == s2[j - 1].lower():
                    dp[i][j] = dp[i - 1][j - 1] + 1
                    max_length = max(max_length, dp[i][j])
                else:
                    dp[i][j] = 0  # 連続する必要があるため、不一致なら0

        return max_length

    def best_match_by_title(self, query: str) -> Optional[Paper]:
        """タイトルに対するLCSが最大のものを返す。LCSが同じ場合はタイトルが短いものを返す"""
        if not query:
            return None

        def get_sort_key_value(paper: Paper) -> Tuple[int, int, int]:
            # smaller the better
            lcs_len = self._lcs_length(query.lower(), paper.title.lower())
            lcss_len = self._lcss_length(query.lower(), paper.title.lower())
            return  -lcss_len, -lcs_len, len(paper.title), paper.paperId

        best_match = sorted(self.papers.values(), key=get_sort_key_value)[0]
        return best_match

    def get_paper(self, paper_id: str) -> Optional[Paper]:
        """論文IDで論文を取得"""
        return self.papers.get(paper_id)

    def get_cites(self, paper_id: str, limit: int = 200) -> List[Paper]:
        """この論文が引用している論文のリストを取得（cited_byの数が多い順）"""
        citation_ids = self.cites.get(paper_id, [])
        papers = [self.papers[pid] for pid in citation_ids if pid in self.papers]
        papers.sort(key=lambda p: p.citationCount, reverse=True)
        return papers[:limit]

    def get_cited_by(self, paper_id: str, limit: int = 200) -> List[Paper]:
        """この論文を引用している論文のリストを取得（cited_byの数が多い順）"""
        cited_by_ids = self.cited_by.get(paper_id, [])
        papers = [self.papers[pid] for pid in cited_by_ids if pid in self.papers]
        papers.sort(key=lambda p: p.citationCount, reverse=True)
        return papers[:limit]


# グローバルCorpusインスタンス
corpus = Corpus()


@app.get("/api/search")
async def search(query: str = Query(..., description="検索クエリ"), limit: int = Query(200, ge=1, le=1000)):
    """タイトルでLCS検索してベストマッチを返す"""
    best_match = corpus.best_match_by_title(query)
    if not best_match:
        return {"paper": None, "message": "No match found"}

    return {
        "paper": best_match.dict(),
        "cites": [p.dict() for p in corpus.get_cites(best_match.paperId, limit)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(best_match.paperId, limit)],
    }


@app.get("/api/paper/{paper_id}")
async def get_paper(paper_id: str, limit: int = Query(200, ge=1, le=1000)):
    """論文IDで論文と引用関係を取得"""
    paper = corpus.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {
        "paper": paper.dict(),
        "cites": [p.dict() for p in corpus.get_cites(paper_id, limit)],
        "cited_by": [p.dict() for p in corpus.get_cited_by(paper_id, limit)],
    }


def main():
    """メイン関数"""
    # 出力フォルダを作成
    PROCESSED_DATA_FOLDER.mkdir(parents=True, exist_ok=True)
    print("API server is ready. Run with: uvicorn process_data:app --reload --port 8000")


if __name__ == "__main__":
    main()
