from semantic_scholar_utils import (
    get_paper_id_by_title,
    list_citing_paper_ids,
    get_paper_metadata,
)
import json
from pathlib import Path
from tqdm import tqdm
import os


DATA_FOLDER = Path(__file__).parent.parent / "data" / "papers"
CITATION_FOLDER = Path(__file__).parent.parent / "data" / "citations"

os.makedirs(DATA_FOLDER, exist_ok=True)
os.makedirs(CITATION_FOLDER, exist_ok=True)


def save_paper_metadata(pid: str, metadata: dict):
    filepath = DATA_FOLDER / f"{pid}.json"
    if filepath.exists():
        return
    with open(DATA_FOLDER / f"{pid}.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=4)


def save_citing_paper_ids(pid: str, citing_ids: list[str]):
    filepath = CITATION_FOLDER / f"{pid}.json"
    if filepath.exists():
        return
    data = {
        "paperId": pid,
        "citationPaperIds": citing_ids,
    }
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def get_paper_metadata_if_not_exists(pid: str):
    filepath = DATA_FOLDER / f"{pid}.json"
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    metadata = get_paper_metadata(pid)
    save_paper_metadata(pid, metadata)
    return metadata


def list_citing_paper_ids_if_not_exists(pid: str):
    filepath = CITATION_FOLDER / f"{pid}.json"
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    citing_ids = list_citing_paper_ids(pid, per_page=100)
    save_citing_paper_ids(pid, citing_ids)
    return citing_ids


def collect_citing_paper_metadata_list(pid: str, verbose: bool = False):
    # この論文を引用している論文たちのメタ情報を収集
    metadata_list = []
    citing_ids = list_citing_paper_ids_if_not_exists(pid)
    if verbose:
        print(f"[INFO] Collecting {len(citing_ids)} citing paper metadata ({pid})")
    for citing_id in tqdm(citing_ids, disable=not verbose):
        metadata_list.append(get_paper_metadata_if_not_exists(citing_id))
    return metadata_list


if __name__ == "__main__":
    # base_title = "The case for learned index structures"
    # base_year = 2017
    base_title = "Partitioned Learned Bloom Filter"
    base_year = 2020

    # 1. base paperのメタ情報を収集し保存
    base_pid = get_paper_id_by_title(base_title, year=base_year)
    base_meta = get_paper_metadata_if_not_exists(base_pid)
    print(f"[INFO] [1/3] Collected base paper metadata: {base_meta['title']} ({base_meta['year']})")

    # 2. base paperを引用している論文のメタ情報を収集し保存
    citing_metadata_list = collect_citing_paper_metadata_list(base_pid, verbose=True)
    print(f"[INFO] [2/3] Collected {len(citing_metadata_list)} citing paper metadata")

    # 3. base paperを引用している論文を引用している論文のメタ情報を収集し保存
    for citing_metadata in tqdm(citing_metadata_list):
        citing_citing_metadata_list = collect_citing_paper_metadata_list(citing_metadata["paperId"], verbose=False)
        for metadata in tqdm(citing_citing_metadata_list):
            save_paper_metadata(metadata["paperId"], metadata)
