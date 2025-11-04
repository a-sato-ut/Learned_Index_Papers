"""
タグ生成モジュール
論文のAbstractをOpenAI APIに送信してタグを生成し、保存します
包含関係を考慮して親タグも自動的に追加します
"""

import json
import os
from pathlib import Path
from typing import Optional, List, Set
from tqdm import tqdm
from openai import OpenAI

# データフォルダのパス
PAPERS_FOLDER = Path(__file__).parent.parent / "data" / "papers"
CITATIONS_FOLDER = Path(__file__).parent.parent / "data" / "citations"
TAG_FOLDER = Path(__file__).parent.parent / "data" / "tags"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"

# タグ一覧
ALL_TAGS = [
    "Learned Index",
    "Learned Bloom Filter",
    "B-tree",
    "LSM-tree",
    "Hash Table",
    "Bloom Filter",
    "Sketch",
    "String Key",
    "Multidimensional",
    "Time-series",
    "Space-Filling Curve",
    "Updatable",
    "Range",
    "Sorting Algorithm",
    "Nearest Neighbor Search",
    "Filter",
    "Disk",
    "Main-memory",
    "Caching",
    "Compression",
    "GPU",
    "Distributed",
    "Database",
    "Query optimization",
    "Cardinality estimation",
    "Reinforcement Learning",
    "LLM",
    "Bioinformatics",
    "Computer Vision",
    "Spline",
    "Theoretical",
    "Security/Adversarial",
    "Benchmark",
    "Survey",
]

# 包含関係の定義（子タグ → 親タグのリスト）
HIERARCHY = {
    "Learned Bloom Filter": ["Learned Index", "Bloom Filter"],
    "Bloom Filter": ["Filter"],
    "Sketch": ["Filter"],
    "Query optimization": ["Database"],
    "Cardinality estimation": ["Database"],
    "Space-Filling Curve": ["Multidimensional"],
    "Time-series": ["Multidimensional"]
}

# OpenAI APIクライアントの初期化
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY環境変数が設定されていません")
client = OpenAI(api_key=api_key)


def get_target_paper_ids() -> list[str]:
    """BASE_PIDとそれを引用している論文のIDリストを取得"""
    paper_ids = {BASE_PID}  # BASE_PID自体を含める
    
    # BASE_PIDを引用している論文のリストを取得
    citation_file = CITATIONS_FOLDER / f"{BASE_PID}.json"
    if citation_file.exists():
        with open(citation_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            citing_paper_ids = data.get("citationPaperIds", [])
            paper_ids.update(citing_paper_ids)
            print(f"Found {len(citing_paper_ids)} papers citing BASE_PID")
    else:
        print(f"Warning: Citation file not found: {citation_file}")
    
    return list(paper_ids)


def load_paper_abstract(paper_id: str) -> Optional[str]:
    """論文のabstractを読み込む"""
    paper_file = PAPERS_FOLDER / f"{paper_id}.json"
    if not paper_file.exists():
        print(f"Warning: Paper file not found: {paper_file}")
        return None
    
    try:
        with open(paper_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            abstract = data.get("abstract")
            if not abstract:
                print(f"Warning: No abstract found for paper {paper_id}")
            return abstract
    except Exception as e:
        print(f"Error loading paper {paper_file}: {e}")
        return None


def load_paper_title(paper_id: str) -> str:
    """論文のタイトルを読み込む"""
    paper_file = PAPERS_FOLDER / f"{paper_id}.json"
    if not paper_file.exists():
        return ""
    
    try:
        with open(paper_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("title", "")
    except Exception:
        return ""


def generate_tags(abstract: str = "", title: str = "") -> Optional[List[str]]:
    """OpenAI APIを使ってタグを生成"""
    if not abstract and not title:
        return None
    
    # プロンプトを構築
    tags_str = "\n".join([f'  "{tag}"' for tag in ALL_TAGS])
    
    if abstract:
        prompt = f"""以下の論文のAbstractを読んで、適切なタグを選択してください。

タグ一覧:
{tags_str}

重要な注意事項:
1. 包含関係があることに注意してください。例えば、"Learned Bloom Filter"のタグがついている論文は、必ず"Learned Index"と"Bloom Filter"のタグもつける必要があります。
2. 関連するタグのみを選択してください。すべてのタグを選択する必要はありません。
3. タグはJSON配列形式で返してください。例: ["Learned Index", "Bloom Filter", "Main-memory"]

"""
        if title:
            prompt += f"タイトル: {title}\n\n"
        prompt += f"Abstract:\n{abstract}\n\n選択したタグをJSON配列形式で返してください（タグ名は正確に一致させること）:"
    else:
        # Abstractがない場合はタイトルのみでタグ付け
        prompt = f"""以下の論文のタイトルを読んで、適切なタグを選択してください。

タグ一覧:
{tags_str}

重要な注意事項:
1. 包含関係があることに注意してください。例えば、"Learned Bloom Filter"のタグがついている論文は、必ず"Learned Index"と"Bloom Filter"のタグもつける必要があります。
2. 関連するタグのみを選択してください。すべてのタグを選択する必要はありません。
3. タグはJSON配列形式で返してください。例: ["Learned Index", "Bloom Filter", "Main-memory"]

タイトル: {title}

選択したタグをJSON配列形式で返してください（タグ名は正確に一致させること）:"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # または "gpt-3.5-turbo" や "gpt-4"
            messages=[
                {
                    "role": "system",
                    "content": "あなたは学術論文の分類を行う専門家です。論文のAbstractまたはタイトルを読み、提供されたタグリストから適切なタグを選択してください。包含関係を考慮して、親タグも必ず含めてください。JSON配列形式のみで返答してください。"
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500,
        )
        
        # レスポンスをパース
        content = response.choices[0].message.content.strip()
        # JSONコードブロックを除去
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        tags = json.loads(content)
        if not isinstance(tags, list):
            return None
        
        # タグがALL_TAGSに含まれているか確認し、無効なタグを除外
        valid_tags = [tag for tag in tags if tag in ALL_TAGS]
        return valid_tags
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}")
        print(f"Response content: {content}")
        return None
    except Exception as e:
        print(f"Error generating tags: {e}")
        return None


def apply_hierarchy(tags: List[str]) -> Set[str]:
    """包含関係を適用して親タグを追加"""
    result_tags = set(tags)
    
    # 階層的に親タグを追加
    changed = True
    while changed:
        changed = False
        new_tags = set(result_tags)
        
        for tag in result_tags:
            if tag in HIERARCHY:
                for parent_tag in HIERARCHY[tag]:
                    if parent_tag not in new_tags:
                        new_tags.add(parent_tag)
                        changed = True
        
        result_tags = new_tags
    
    return result_tags


def save_tags(paper_id: str, title: str, abstract: str, tags: List[str]):
    """タグをJSONファイルに保存"""
    TAG_FOLDER.mkdir(parents=True, exist_ok=True)
    
    output_file = TAG_FOLDER / f"{paper_id}.json"
    data = {
        "paperId": paper_id,
        "title": title,
        "abstract": abstract,
        "tags": sorted(tags),  # ソートして一貫性を保つ
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    """メイン関数"""
    print(f"BASE_PID: {BASE_PID}")
    print(f"タグ保存先: {TAG_FOLDER}")
    print(f"利用可能なタグ数: {len(ALL_TAGS)}")
    
    # 対象論文のIDリストを取得
    paper_ids = get_target_paper_ids()
    print(f"対象論文数: {len(paper_ids)}")
    
    # 既にタグが生成されている論文をスキップ
    existing_papers = set()
    if TAG_FOLDER.exists():
        for file in TAG_FOLDER.glob("*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    existing_papers.add(data.get("paperId"))
            except Exception:
                pass
    
    # 処理が必要な論文をフィルタリング
    papers_to_process = [pid for pid in paper_ids if pid not in existing_papers]
    print(f"処理が必要な論文数: {len(papers_to_process)}")
    print(f"既に処理済みの論文数: {len(existing_papers)}")
    
    if not papers_to_process:
        print("処理が必要な論文がありません。")
        return
    
    # 各論文のタグを生成
    success_count = 0
    fail_count = 0
    
    for paper_id in tqdm(papers_to_process, desc="タグ生成中"):
        # 論文情報を読み込む
        abstract = load_paper_abstract(paper_id)
        title = load_paper_title(paper_id)
        
        if not abstract and not title:
            print(f"Skipping {paper_id}: No abstract or title found")
            fail_count += 1
            continue
        
        # タグを生成（abstractがない場合はtitleのみでタグ付け）
        tags = generate_tags(abstract or "", title)
        
        if not tags:
            print(f"Failed to generate tags for {paper_id}")
            fail_count += 1
            continue
        
        # 包含関係を適用
        final_tags = apply_hierarchy(tags)
        final_tags_list = sorted(list(final_tags))
        
        # 保存
        save_tags(paper_id, title, abstract, final_tags_list)
        success_count += 1
    
    print(f"\n完了: {success_count}件成功, {fail_count}件失敗")


if __name__ == "__main__":
    main()

