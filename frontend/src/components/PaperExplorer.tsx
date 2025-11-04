import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Paper, SearchResult, PaperNode, PaperEdge } from '../types';
import './PaperExplorer.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

interface PaperExplorerProps {}

const PaperExplorer: React.FC<PaperExplorerProps> = () => {
  const [query, setQuery] = useState('Partitioned Learned Bloom Filter');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'graph'>('list');
  const svgRef = useRef<SVGSVGElement>(null);

  const searchPapers = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const url = `${API_BASE}/api/search?query=${encodeURIComponent(query)}`;
      console.log('Searching with URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SearchResult = await response.json();
      console.log('Search result:', data);
      
      setResult(data);
      if (data.paper && activeTab === 'graph') {
        setTimeout(() => drawGraph(data), 100);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      alert(`検索に失敗しました: ${errorMessage}\n\nバックエンドサーバー（${API_BASE}）が起動しているか確認してください。`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchPapers();
    }
  };

  useEffect(() => {
    // デフォルトクエリで検索
    searchPapers();
  }, []);

  useEffect(() => {
    if (result && result.paper && activeTab === 'graph') {
      drawGraph(result);
    }
  }, [result, activeTab]);

  const drawGraph = async (data: SearchResult) => {
    if (!svgRef.current || !data.paper) return;

    const centerPaper = data.paper;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1200;
    const height = svgRef.current.clientHeight || 800;

    const nodes: PaperNode[] = [];
    const edges: PaperEdge[] = [];
    const nodeMap = new Map<string, PaperNode>();

    const centerNode: PaperNode = {
      id: centerPaper.paperId,
      paper: centerPaper,
      type: 'center',
      fx: width / 2,
      fy: height / 2,
    };
    nodes.push(centerNode);
    nodeMap.set(centerPaper.paperId, centerNode);

    data.cites.forEach((paper) => {
      const node: PaperNode = {
        id: paper.paperId,
        paper,
        type: 'cites',
      };
      nodes.push(node);
      nodeMap.set(paper.paperId, node);
      edges.push({
        source: centerPaper.paperId,
        target: paper.paperId,
        type: 'cites',
      });
    });

    const citesLevel2Promises = data.cites.map(async (citedPaper) => {
      try {
        const response = await fetch(`${API_BASE}/api/paper/${citedPaper.paperId}?limit=20`);
        if (response.ok) {
          const paperData = await response.json();
          return { cites: paperData.cites || [], cited_by: paperData.cited_by || [] };
        }
      } catch (error) {
        console.error(`Error fetching data for ${citedPaper.paperId}:`, error);
      }
      return { cites: [], cited_by: [] };
    });

    const citedByLevel2Promises = data.cited_by.map(async (citingPaper) => {
      try {
        const response = await fetch(`${API_BASE}/api/paper/${citingPaper.paperId}?limit=20`);
        if (response.ok) {
          const paperData = await response.json();
          return { cites: paperData.cites || [], cited_by: paperData.cited_by || [] };
        }
      } catch (error) {
        console.error(`Error fetching data for ${citingPaper.paperId}:`, error);
      }
      return { cites: [], cited_by: [] };
    });

    const [citesLevel2Results, citedByLevel2Results] = await Promise.all([
      Promise.all(citesLevel2Promises),
      Promise.all(citedByLevel2Promises),
    ]);

    data.cites.forEach((level1Paper, index) => {
      const level2Data = citesLevel2Results[index];
      
      level2Data.cites.forEach((level2Paper: Paper) => {
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cites',
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level1Paper.paperId,
          target: level2Paper.paperId,
          type: 'cites',
        });
      });

      level2Data.cited_by.forEach((level2Paper: Paper) => {
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level2Paper.paperId,
          target: level1Paper.paperId,
          type: 'cited_by',
        });
      });
    });

    data.cited_by.forEach((level1Paper, index) => {
      if (!nodeMap.has(level1Paper.paperId)) {
        const node: PaperNode = {
          id: level1Paper.paperId,
          paper: level1Paper,
          type: 'cited_by',
        };
        nodes.push(node);
        nodeMap.set(level1Paper.paperId, node);
      }
      edges.push({
        source: level1Paper.paperId,
        target: centerPaper.paperId,
        type: 'cited_by',
      });

      const level2Data = citedByLevel2Results[index];
      
      level2Data.cites.forEach((level2Paper: Paper) => {
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level1Paper.paperId,
          target: level2Paper.paperId,
          type: 'cites',
        });
      });

      level2Data.cited_by.forEach((level2Paper: Paper) => {
        if (!nodeMap.has(level2Paper.paperId)) {
          const node: PaperNode = {
            id: level2Paper.paperId,
            paper: level2Paper,
            type: 'cited_by',
          };
          nodes.push(node);
          nodeMap.set(level2Paper.paperId, node);
        }
        edges.push({
          source: level2Paper.paperId,
          target: level1Paper.paperId,
          type: 'cited_by',
        });
      });
    });

    // リンクの定義
    const link = svg
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, PaperEdge>('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d) => (d.type === 'cites' ? '#3b82f6' : '#ef4444'))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    // ノードの定義
    const node = svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, PaperNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, PaperNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      );

    // ノードの円
    node
      .append('circle')
      .attr('r', (d) => (d.type === 'center' ? 12 : 6))
      .attr('fill', (d) => {
        if (d.type === 'center') return '#10b981';
        return d.type === 'cites' ? '#3b82f6' : '#ef4444';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // ノードのラベル
    node
      .append('text')
      .text((d) => d.paper.title.substring(0, 30) + (d.paper.title.length > 30 ? '...' : ''))
      .attr('dx', (d) => (d.type === 'center' ? 15 : 10))
      .attr('dy', 4)
      .attr('font-size', (d) => (d.type === 'center' ? '12px' : '10px'))
      .attr('fill', '#333')
      .style('pointer-events', 'none');

    // シミュレーション
    const simulation = d3
      .forceSimulation<PaperNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<PaperNode, PaperEdge>(edges)
          .id((d: PaperNode) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody<PaperNode>().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<PaperNode>().radius(30));

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.x || 0;
        })
        .attr('y1', (d) => {
          const source = typeof d.source === 'object' ? d.source : nodes.find((n) => n.id === d.source);
          return source?.y || 0;
        })
        .attr('x2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.x || 0;
        })
        .attr('y2', (d) => {
          const target = typeof d.target === 'object' ? d.target : nodes.find((n) => n.id === d.target);
          return target?.y || 0;
        });

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, PaperNode, PaperNode>) {
      if (!event.active) simulation.alphaTarget(0);
      if (event.subject.type === 'center') {
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      } else {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }
  };

  const PaperCard: React.FC<{ paper: Paper; type: 'cites' | 'cited_by' }> = ({ paper, type }) => {
    return (
      <div className={`paper-card paper-card-${type}`}>
        <div className="paper-card-header">
          <h3 className="paper-card-title">
            <a href={paper.url} target="_blank" rel="noopener noreferrer">
              {paper.title}
            </a>
          </h3>
          <span className="paper-card-type">{type === 'cites' ? 'Cites' : 'Cited by'}</span>
        </div>
        <div className="paper-card-meta">
          {paper.year && <span className="paper-card-year">{paper.year}</span>}
          {paper.venue && <span className="paper-card-venue">{paper.venue}</span>}
          {paper.authors.length > 0 && (
            <span className="paper-card-authors">{paper.authors.slice(0, 3).join(', ')}</span>
          )}
        </div>
        {paper.abstract && (
          <p className="paper-card-abstract">{paper.abstract.substring(0, 200)}...</p>
        )}
        <div className="paper-card-footer">
          <span>Citations: {paper.citationCount}</span>
          {paper.arxivId && (
            <a
              href={`https://arxiv.org/abs/${paper.arxivId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="paper-card-arxiv"
            >
              arXiv:{paper.arxivId}
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="paper-explorer">
      <div className="paper-explorer-header">
        <h1>📚 Learned Index Papers - Citation Network</h1>
        <p className="subtitle">論文の引用関係ネットワーク可視化</p>
      </div>

      <div className="paper-explorer-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="論文タイトルで検索..."
          className="paper-explorer-input"
        />
        <button onClick={searchPapers} disabled={loading} className="paper-explorer-button">
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      {result && result.paper && (
        <>
          <div className="paper-explorer-result-header">
            <div className="paper-explorer-result-main">
              <h2>{result.paper.title}</h2>
              <div className="paper-explorer-result-meta">
                {result.paper.year && <span>{result.paper.year}</span>}
                {result.paper.venue && <span>{result.paper.venue}</span>}
                {result.paper.authors.length > 0 && (
                  <span>{result.paper.authors.join(', ')}</span>
                )}
              </div>
              {result.paper.abstract && (
                <p className="paper-explorer-result-abstract">{result.paper.abstract}</p>
              )}
            </div>
          </div>

          <div className="paper-explorer-tabs">
            <button
              className={`paper-explorer-tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              List ({result.cites.length} Cites, {result.cited_by.length} Cited by)
            </button>
            <button
              className={`paper-explorer-tab ${activeTab === 'graph' ? 'active' : ''}`}
              onClick={() => setActiveTab('graph')}
            >
              Graph
            </button>
          </div>

          {activeTab === 'list' && (
            <div className="paper-explorer-list">
              <div className="paper-explorer-list-section">
                <h3 className="paper-explorer-list-title">Cites ({result.cites.length})</h3>
                <div className="paper-explorer-list-grid">
                  {result.cites.map((paper) => (
                    <PaperCard key={paper.paperId} paper={paper} type="cites" />
                  ))}
                </div>
              </div>
              <div className="paper-explorer-list-section">
                <h3 className="paper-explorer-list-title">Cited by ({result.cited_by.length})</h3>
                <div className="paper-explorer-list-grid">
                  {result.cited_by.map((paper) => (
                    <PaperCard key={paper.paperId} paper={paper} type="cited_by" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="paper-explorer-graph">
              <svg ref={svgRef} width="100%" height="800px" />
            </div>
          )}
        </>
      )}

      {result && !result.paper && (
        <div className="paper-explorer-no-result">
          <p>該当する論文が見つかりませんでした。</p>
        </div>
      )}
    </div>
  );
};

export default PaperExplorer;

