import { Paper, SearchResult, PapersByTagResult, PapersByAuthorResult, PapersByVenueResult, AuthorRankingItem } from './types';

export interface AllData {
  papers: Paper[];
  tags: Array<{ tag: string; count: number }>;
  authors: Array<{ author: string; count: number }>;
  venues: Array<{ venue: string; count: number }>;
  authorRanking: AuthorRankingItem[];
}

let cachedData: AllData | null = null;

export async function loadAllData(): Promise<AllData> {
  if (cachedData) {
    return cachedData;
  }
  
  const response = await fetch('/all_data.json');
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.statusText}`);
  }
  
  const data = await response.json();
  cachedData = data;
  return data;
}

// LCS（最長共通部分列）の長さを計算
function lcsLength(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// LCSS（最長共通部分文字列）の長さを計算
function lcssLength(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  let maxLength = 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        maxLength = Math.max(maxLength, dp[i][j]);
      } else {
        dp[i][j] = 0;
      }
    }
  }

  return maxLength;
}

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

export function searchByTitle(query: string, data: AllData): SearchResult {
  if (!query.trim()) {
    return { paper: null, cites: [], cited_by: [] };
  }

  // ベストマッチを検索
  const queryLower = query.toLowerCase();
  const papers = data.papers;
  
  const scoredPapers = papers.map(paper => {
    const lcsLen = lcsLength(queryLower, paper.title.toLowerCase());
    const lcssLen = lcssLength(queryLower, paper.title.toLowerCase());
    return {
      paper,
      score: { lcssLen, lcsLen, titleLength: paper.title.length, paperId: paper.paperId }
    };
  });

  scoredPapers.sort((a, b) => {
    if (b.score.lcssLen !== a.score.lcssLen) return b.score.lcssLen - a.score.lcssLen;
    if (b.score.lcsLen !== a.score.lcsLen) return b.score.lcsLen - a.score.lcsLen;
    if (a.score.titleLength !== b.score.titleLength) return a.score.titleLength - b.score.titleLength;
    return a.score.paperId.localeCompare(b.score.paperId);
  });

  const bestMatch = scoredPapers[0]?.paper;
  if (!bestMatch) {
    return { paper: null, cites: [], cited_by: [] };
  }

  // citesとcited_byを取得
  const citesIds = bestMatch.cites || [];
  const citedByIds = bestMatch.cited_by || [];
  
  const cites = citesIds
    .map(id => papers.find(p => p.paperId === id))
    .filter((p): p is Paper => p !== undefined)
    .sort((a, b) => b.citationCount - a.citationCount);
  
  const cited_by = citedByIds
    .map(id => papers.find(p => p.paperId === id))
    .filter((p): p is Paper => p !== undefined)
    .sort((a, b) => b.citationCount - a.citationCount);

  return {
    paper: bestMatch,
    cites,
    cited_by,
  };
}

export function filterPapers(
  papers: Paper[],
  tags?: string[],
  authors?: string[],
  venues?: string[],
  minYear?: number | null
): Paper[] {
  let filtered = [...papers];

  if (tags && tags.length > 0) {
    filtered = filtered.filter(p => 
      p.tags && tags.every(tag => p.tags!.includes(tag))
    );
  }

  if (authors && authors.length > 0) {
    filtered = filtered.filter(p => 
      p.authors && authors.every(author => p.authors!.includes(author))
    );
  }

  if (venues && venues.length > 0) {
    const normalizedVenues = venues.map(v => normalizeVenue(v));
    filtered = filtered.filter(p => 
      p.venue && normalizedVenues.includes(normalizeVenue(p.venue))
    );
  }

  if (minYear !== null && minYear !== undefined) {
    filtered = filtered.filter(p => 
      p.year !== null && p.year !== undefined && p.year >= minYear
    );
  }

  return filtered;
}

export function getPapersByTag(
  tags: string[],
  data: AllData,
  minYear?: number | null
): PapersByTagResult {
  const papers = filterPapers(data.papers, tags, undefined, undefined, minYear);
  papers.sort((a, b) => b.citationCount - a.citationCount);
  
  return {
    papers,
    tags,
    count: papers.length,
  };
}

export function getPapersByAuthor(
  authors: string[],
  data: AllData,
  minYear?: number | null
): PapersByAuthorResult {
  const papers = filterPapers(data.papers, undefined, authors, undefined, minYear);
  papers.sort((a, b) => b.citationCount - a.citationCount);
  
  return {
    papers,
    authors,
    count: papers.length,
  };
}

export function getPapersByVenue(
  venues: string[],
  data: AllData,
  minYear?: number | null
): PapersByVenueResult {
  const papers = filterPapers(data.papers, undefined, undefined, venues, minYear);
  papers.sort((a, b) => b.citationCount - a.citationCount);
  
  return {
    papers,
    venues,
    count: papers.length,
  };
}

export function getPaperById(paperId: string, data: AllData): Paper | null {
  return data.papers.find(p => p.paperId === paperId) || null;
}

