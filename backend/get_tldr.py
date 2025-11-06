"""
TLDR生成モジュール
論文のAbstractをOpenAI APIに送信してTLDRを生成し、保存します
"""

import json
import os
from pathlib import Path
from typing import Optional
from tqdm import tqdm
from openai import OpenAI

# データフォルダのパス
PAPERS_FOLDER = Path("data") / "papers"
CITATIONS_FOLDER = Path("data") / "citations"
TLDR_FOLDER = Path("data") / "tldr"
BASE_PID = "0539535989147bc7033f4a34931c7b8e17f1c650"

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


def generate_tldr(abstract: str, title: str = "") -> Optional[str]:
    """OpenAI APIを使ってTLDRを生成"""
    if not abstract:
        return None
    
    # プロンプトを構築
    prompt = "Read the following paper's Abstract and generate a concise TLDR (Too Long; Didn't Read) in English. The TLDR should be approximately 250 characters."
    if title:
        prompt += f"\n\nTitle: {title}\n\n"
    prompt += f"Abstract:\n{abstract}\n\nTLDR (in English, approximately 250 characters):"
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # または "gpt-3.5-turbo" や "gpt-4"
            messages=[
                {"role": "system", "content": "You are an expert in academic paper summarization. Read the Abstract and generate a concise and accurate TLDR in English. The TLDR should be approximately 250 characters."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500,
        )
        tldr = response.choices[0].message.content.strip()
        return tldr
    except Exception as e:
        print(f"Error generating TLDR: {e}")
        return None


def save_tldr(paper_id: str, title: str, abstract: str, tldr: str):
    """TLDRをJSONファイルに保存"""
    TLDR_FOLDER.mkdir(parents=True, exist_ok=True)
    
    output_file = TLDR_FOLDER / f"{paper_id}.json"
    data = {
        "paperId": paper_id,
        "title": title,
        "abstract": abstract,
        "tldr": tldr,
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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


def main():
    """メイン関数"""
    print(f"BASE_PID: {BASE_PID}")
    print(f"TLDR保存先: {TLDR_FOLDER}")
    
    # 対象論文のIDリストを取得
    paper_ids = get_target_paper_ids()
    print(f"対象論文数: {len(paper_ids)}")
    
    # 既にTLDRが生成されている論文をスキップ
    existing_papers = set()
    if TLDR_FOLDER.exists():
        for file in TLDR_FOLDER.glob("*.json"):
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
    
    # 各論文のTLDRを生成
    success_count = 0
    fail_count = 0
    
    for paper_id in tqdm(papers_to_process, desc="TLDR生成中"):
        # 論文情報を読み込む
        abstract = load_paper_abstract(paper_id)
        title = load_paper_title(paper_id)
        
        if not abstract:
            print(f"Skipping {paper_id}: No abstract found")
            fail_count += 1
            continue
        
        # TLDRを生成
        tldr = generate_tldr(abstract, title)
        
        if not tldr:
            print(f"Failed to generate TLDR for {paper_id}")
            fail_count += 1
            continue
        
        # 保存
        save_tldr(paper_id, title, abstract, tldr)
        success_count += 1
    
    print(f"\n完了: {success_count}件成功, {fail_count}件失敗")


if __name__ == "__main__":
    main()

