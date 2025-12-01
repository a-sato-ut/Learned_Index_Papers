import { Paper, AuthorRankingItem, AuthorTagStat, AuthorConferenceStat } from './types';

// venue名を正規化（年と序数詞を除去）
function normalizeVenue(venue: string): string {
  if (!venue) return venue;
  
  // 文中の年を除去
  let normalized = venue.replace(/\s+(19|20)\d{2}(-\d{2})?\s+/g, ' ');
  // 末尾の年を除去
  normalized = normalized.replace(/\s+(19|20)\d{2}(-\d{2})?$/g, '');
  // 先頭の年を除去
  normalized = normalized.replace(/^(19|20)\d{2}(-\d{2})?\s+/g, '');
  // 括弧内の年を除去
  normalized = normalized.replace(/\s*\([^)]*(19|20)\d{2}[^)]*\)/g, '');
  normalized = normalized.replace(/\s*\[[^\]]*(19|20)\d{2}[^\]]*\]/g, '');
  // 末尾の短縮形の年を除去
  normalized = normalized.replace(/\s+'?\d{2}$/g, '');
  // 文中の短縮形の年を除去
  normalized = normalized.replace(/\s+'?\d{2}\s+/g, ' ');
  // 序数詞を除去
  normalized = normalized.replace(/\s+\d+(st|nd|rd|th)\s+/gi, ' ');
  normalized = normalized.replace(/^\d+(st|nd|rd|th)\s+/gi, '');
  normalized = normalized.replace(/\s+\d+(st|nd|rd|th)$/gi, '');
  // 連続するスペースを1つにまとめる
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

export function calculateAuthorRanking(
  papers: Paper[],
  minYear?: number | null
): AuthorRankingItem[] {
  const authorStats: Map<string, {
    author: string;
    paperCount: number;
    totalCitations: number;
    tags: Map<string, number>;
    conferences: Map<string, number>;
  }> = new Map();
  
  for (const paper of papers) {
    // 年フィルタリング
    if (minYear !== null && minYear !== undefined) {
      if (paper.year === null || paper.year === undefined || paper.year < minYear) {
        continue;
      }
    }
    
    if (paper.authors && paper.authors.length > 0) {
      for (const author of paper.authors) {
        if (!authorStats.has(author)) {
          authorStats.set(author, {
            author,
            paperCount: 0,
            totalCitations: 0,
            tags: new Map(),
            conferences: new Map(),
          });
        }
        
        const stats = authorStats.get(author)!;
        stats.paperCount += 1;
        stats.totalCitations += paper.citationCount;
        
        // タグを集計
        if (paper.tags) {
          for (const tag of paper.tags) {
            stats.tags.set(tag, (stats.tags.get(tag) || 0) + 1);
          }
        }
        
        // カンファレンスを集計（正規化したvenue名を使用）
        if (paper.venue) {
          const normalizedVenue = normalizeVenue(paper.venue);
          if (normalizedVenue) {
            stats.conferences.set(normalizedVenue, (stats.conferences.get(normalizedVenue) || 0) + 1);
          }
        }
      }
    }
  }
  
  // リスト形式に変換
  const result: AuthorRankingItem[] = [];
  authorStats.forEach((stats) => {
    const tags: AuthorTagStat[] = [];
    stats.tags.forEach((count, tag) => {
      tags.push({ tag, count });
    });
    tags.sort((a, b) => b.count - a.count);
    
    const conferences: AuthorConferenceStat[] = [];
    stats.conferences.forEach((count, conference) => {
      conferences.push({ conference, count });
    });
    conferences.sort((a, b) => b.count - a.count);
    
    result.push({
      author: stats.author,
      paperCount: stats.paperCount,
      totalCitations: stats.totalCitations,
      tags,
      conferences,
      affiliations: [], // 著者情報は元のデータから取得する必要がある
    });
  });
  
  return result;
}

