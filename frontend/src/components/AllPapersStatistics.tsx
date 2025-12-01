import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Paper } from '../types';
import { loadAllData } from '../dataLoader';
import './AllPapersStatistics.css';

// 円グラフの共通ハイパーパラメータ
const PIE_CHART_CONFIG = {
  topN: 40, // 上位何件を表示するか
  width: 600,
  pieRadius: 120,
  pieHeight: 300,
  legendItemHeight: 22,
  legendColumns: 1,
  legendColumnWidth: 280,
  maxTextLength: 50, // 凡例のテキストの最大文字数
};

// 折れ線グラフの設定
// 凡例の幅を考慮して、SVGの幅を調整
const LINE_CHART_CONFIG = {
  width: 1350, // グラフ部分の幅を調整
  height: 600,
  margin: { top: 20, right: 600, bottom: 60, left: 80 }, // 右マージンを増やして凡例のスペースを確保（2列分）
};

const AllPapersStatistics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [tagVisibility, setTagVisibility] = useState<Record<string, boolean>>({});
  const tagStatsRef = useRef<SVGSVGElement>(null);
  const venueStatsRef = useRef<SVGSVGElement>(null);
  const yearStatsRef = useRef<SVGSVGElement>(null);
  const authorStatsRef = useRef<SVGSVGElement>(null);
  const lineChartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadAllData();
        setPapers(data.papers || []);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('データの読み込みに失敗しました。all_data.jsonファイルが存在するか確認してください。');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!papers || papers.length === 0) return;

    // タグの可視性を初期化（全タグをデフォルトで表示）
    // 全タグを取得（年がない論文も含む）
    const allTagsSet = new Set<string>();
    papers.forEach(paper => {
      if (paper.tags) {
        paper.tags.forEach(tag => allTagsSet.add(tag));
      }
    });
    
    const allTags = Array.from(allTagsSet);
    
    // 既存の可視性を保持しつつ、新しいタグを追加
    const updatedVisibility: Record<string, boolean> = { ...tagVisibility };
    let hasNewTags = false;
    allTags.forEach(tag => {
      if (updatedVisibility[tag] === undefined) {
        updatedVisibility[tag] = true;
        hasNewTags = true;
      }
    });
    
    if (hasNewTags || Object.keys(tagVisibility).length === 0) {
      setTagVisibility(updatedVisibility);
    }

    // タグ統計を計算
    const tagCounts = new Map<string, number>();
    papers.forEach(paper => {
      if (paper.tags) {
        paper.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // カンファレンス統計を計算
    const venueCounts = new Map<string, number>();
    papers.forEach(paper => {
      if (paper.venue) {
        venueCounts.set(paper.venue, (venueCounts.get(paper.venue) || 0) + 1);
      }
    });

    // 年統計を計算
    const yearCounts = new Map<string, number>();
    papers.forEach(paper => {
      if (paper.year !== undefined && paper.year !== null) {
        const yearStr = paper.year.toString();
        yearCounts.set(yearStr, (yearCounts.get(yearStr) || 0) + 1);
      }
    });

    // 著者統計を計算
    const authorCounts = new Map<string, number>();
    papers.forEach(paper => {
      if (paper.authors && paper.authors.length > 0) {
        paper.authors.forEach(author => {
          authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
        });
      }
    });

    // タグ円グラフを描画
    if (tagStatsRef.current && tagCounts.size > 0) {
      const svg = d3.select(tagStatsRef.current);
      svg.selectAll('*').remove();

      const sortedTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedTags.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedTags))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedTags.forEach((tag, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${tag[0]} (${tag[1]})`);

        if (tag[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${tag[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${tag[1]})`);
        }
      });
    }

    // カンファレンス円グラフを描画
    if (venueStatsRef.current && venueCounts.size > 0) {
      const svg = d3.select(venueStatsRef.current);
      svg.selectAll('*').remove();

      const sortedVenues = Array.from(venueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedVenues.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemeSet2);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedVenues))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedVenues.forEach((venue, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${venue[0]} (${venue[1]})`);

        if (venue[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${venue[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${venue[1]})`);
        }
      });
    }

    // 年円グラフを描画
    if (yearStatsRef.current && yearCounts.size > 0) {
      const svg = d3.select(yearStatsRef.current);
      svg.selectAll('*').remove();

      const sortedYears = Array.from(yearCounts.entries())
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedYears.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemePastel1);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedYears))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedYears.forEach((year, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${year[0]}年 (${year[1]})`);

        const yearText = `${year[0]}年 (${year[1]})`;
        if (yearText.length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${yearText.substring(0, PIE_CHART_CONFIG.maxTextLength)}...`);
        }
      });
    }

    // 著者円グラフを描画
    if (authorStatsRef.current && authorCounts.size > 0) {
      const svg = d3.select(authorStatsRef.current);
      svg.selectAll('*').remove();

      const sortedAuthors = Array.from(authorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, PIE_CHART_CONFIG.topN);

      const { width, pieRadius, pieHeight, legendItemHeight, legendColumns, legendColumnWidth } = PIE_CHART_CONFIG;
      const legendRows = Math.ceil(sortedAuthors.length / legendColumns);
      const legendHeight = legendRows * legendItemHeight;
      const totalHeight = pieHeight + legendHeight + 40;

      svg
        .attr('width', width)
        .attr('height', totalHeight);

      const g = svg
        .append('g')
        .attr('transform', `translate(${width / 2}, ${pieHeight / 2})`);

      const pie = d3.pie<[string, number]>()
        .value(d => d[1])
        .sort(null);

      const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
        .innerRadius(0)
        .outerRadius(pieRadius);

      const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

      const arcs = g
        .selectAll('.arc')
        .data(pie(sortedAuthors))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i.toString()))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(_event, _d) {
          d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function(_event, _d) {
          d3.select(this).attr('opacity', 1);
        });

      const legend = svg
        .append('g')
        .attr('transform', `translate(${width / 2 - (legendColumnWidth * legendColumns) / 2}, ${pieHeight + 20})`);

      sortedAuthors.forEach((author, i) => {
        const col = i % legendColumns;
        const row = Math.floor(i / legendColumns);
        const x = col * legendColumnWidth;
        const y = row * legendItemHeight;

        const legendRow = legend
          .append('g')
          .attr('transform', `translate(${x}, ${y})`);

        legendRow
          .append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', colorScale(i.toString()))
          .attr('rx', 2);

        const text = legendRow
          .append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(`${author[0]} (${author[1]})`);

        if (author[0].length > PIE_CHART_CONFIG.maxTextLength) {
          text.text(`${author[0].substring(0, PIE_CHART_CONFIG.maxTextLength)}... (${author[1]})`);
        }
      });
    }

    // 折れ線グラフを描画（年ごとのタグ別論文数）
    if (lineChartRef.current) {
      const svg = d3.select(lineChartRef.current);
      svg.selectAll('*').remove();

      // まず、全タグを取得（年がない論文も含む）
      const allTagsSet = new Set<string>();
      papers.forEach(paper => {
        if (paper.tags) {
          paper.tags.forEach(tag => allTagsSet.add(tag));
        }
      });

      // 年ごとのタグ別論文数を計算
      const tagYearData = new Map<string, Map<number, number>>(); // tag -> {year -> count}
      
      papers.forEach(paper => {
        if (paper.year !== undefined && paper.year !== null && paper.tags) {
          paper.tags.forEach(tag => {
            if (!tagYearData.has(tag)) {
              tagYearData.set(tag, new Map());
            }
            const yearMap = tagYearData.get(tag)!;
            yearMap.set(paper.year!, (yearMap.get(paper.year!) || 0) + 1);
          });
        }
      });

      // 全タグを取得（論文数順にソート）
      // 年がない論文のタグも含める（totalCount = 0として扱う）
      const tagCounts = Array.from(allTagsSet).map(tag => {
        const yearMap = tagYearData.get(tag) || new Map<number, number>();
        // 年がない論文のタグもカウント
        const papersWithTag = papers.filter(p => p.tags && p.tags.includes(tag));
        const actualTotalCount = papersWithTag.length;
        return {
          tag,
          totalCount: actualTotalCount, // 実際の論文数を使用
          yearMap,
        };
      }).sort((a, b) => b.totalCount - a.totalCount);

      if (tagCounts.length === 0) return;

      // 全年の範囲を取得
      const allYears = new Set<number>();
      papers.forEach(paper => {
        if (paper.year !== undefined && paper.year !== null) {
          allYears.add(paper.year);
        }
      });
      const years = Array.from(allYears).sort((a, b) => a - b);

      const { width, margin } = LINE_CHART_CONFIG;
      const innerWidth = width - margin.left - margin.right;
      
      // 凡例の高さを計算（2列に分けるため、各タグ22px、列数で割る）
      const legendColumns = 2;
      const legendRowsPerColumn = Math.ceil(tagCounts.length / legendColumns);
      const legendHeight = legendRowsPerColumn * 22 + 40;
      // グラフ部分の高さ
      const graphHeight = 600;
      // SVGの高さを動的に計算（グラフと凡例の高さの大きい方を使用）
      const height = Math.max(graphHeight, legendHeight);
      const innerHeight = height - margin.top - margin.bottom;

      svg
        .attr('width', width)
        .attr('height', height);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

      // スケールを設定
      const xScale = d3.scaleLinear()
        .domain([d3.min(years) || 0, d3.max(years) || 0])
        .range([0, innerWidth]);

      // 表示されているタグのみで最大値を計算
      const visibleTagCounts = tagCounts.filter(tagData => 
        tagVisibility[tagData.tag] !== false
      );
      
      const maxCount = visibleTagCounts.length > 0 
        ? d3.max(visibleTagCounts, d => 
            d3.max(Array.from(d.yearMap.values())) || 0
          ) || 0
        : 0;

      const yScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range([innerHeight, 0]);

      // 色スケール（より多くの色を使用）
      const colors = [
        ...d3.schemeCategory10,
        ...d3.schemeSet2,
        ...d3.schemePastel1,
        ...d3.schemeTableau10,
      ];
      const colorScale = d3.scaleOrdinal(colors);

      // 折れ線を生成
      const line = d3.line<{ year: number; count: number }>()
        .x(d => xScale(d.year))
        .y(d => yScale(d.count))
        .curve(d3.curveMonotoneX);

      // 各タグの折れ線を描画（表示されているタグのみ）
      visibleTagCounts.forEach((tagData, _i) => {
        const originalIndex = tagCounts.findIndex(t => t.tag === tagData.tag);
        const dataPoints: Array<{ year: number; count: number }> = years.map(year => ({
          year,
          count: tagData.yearMap.get(year) || 0,
        }));

        const path = g
          .append('path')
          .datum(dataPoints)
          .attr('fill', 'none')
          .attr('stroke', colorScale(originalIndex.toString()))
          .attr('stroke-width', 2)
          .attr('d', line)
          .attr('opacity', tagVisibility[tagData.tag] !== false ? 1 : 0);

        // アニメーション
        const totalLength = path.node()?.getTotalLength() || 0;
        path
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1000)
          .attr('stroke-dashoffset', 0);

        // 各データポイントに円を追加
        g.selectAll(`.dot-${originalIndex}`)
          .data(dataPoints)
          .enter()
          .append('circle')
          .attr('class', `dot-${originalIndex}`)
          .attr('cx', d => xScale(d.year))
          .attr('cy', d => yScale(d.count))
          .attr('r', 4)
          .attr('fill', colorScale(originalIndex.toString()))
          .attr('opacity', tagVisibility[tagData.tag] !== false ? 1 : 0)
          .style('cursor', 'pointer')
          .on('mouseover', function(_event, d) {
            d3.select(this).attr('r', 6);
            
            // ツールチップを表示
            const tooltip = g.append('g')
              .attr('class', 'tooltip')
              .attr('transform', `translate(${xScale(d.year)}, ${yScale(d.count)})`);

            tooltip.append('rect')
              .attr('x', -40)
              .attr('y', -35)
              .attr('width', 80)
              .attr('height', 30)
              .attr('fill', 'rgba(0, 0, 0, 0.8)')
              .attr('rx', 4);

            tooltip.append('text')
              .attr('text-anchor', 'middle')
              .attr('fill', 'white')
              .attr('font-size', '11px')
              .attr('dy', -15)
              .text(tagData.tag);

            tooltip.append('text')
              .attr('text-anchor', 'middle')
              .attr('fill', 'white')
              .attr('font-size', '12px')
              .attr('dy', -2)
              .text(`${d.year}年: ${d.count}件`);
          })
          .on('mouseout', function(_event, _d) {
            d3.select(this).attr('r', 4);
            g.selectAll('.tooltip').remove();
          });
      });

      // X軸
      g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat(d => d.toString()))
        .append('text')
        .attr('x', innerWidth / 2)
        .attr('y', 50)
        .attr('fill', '#333')
        .attr('font-size', '14px')
        .attr('text-anchor', 'middle')
        .text('年');

      // Y軸
      g.append('g')
        .call(d3.axisLeft(yScale))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -50)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#333')
        .attr('font-size', '14px')
        .attr('text-anchor', 'middle')
        .text('論文数');

      // 凡例を外側（右側）に配置（総件数順にソート、2列表示）
      const legendColumnWidth = 280; // 1列の幅
      const legendStartX = width - margin.right + 20;
      
      const legendContainer = svg.append('g')
        .attr('transform', `translate(${legendStartX}, ${margin.top})`);

      // 全タグを凡例に表示（totalCountが0でも表示、2列に分ける）
      tagCounts.forEach((tagData, i) => {
        // tagVisibilityが未定義の場合はtrueとして扱う（デフォルトで表示）
        const isVisible = tagVisibility[tagData.tag] !== false;
        
        // 列と行のインデックスを計算
        const columnIndex = Math.floor(i / legendRowsPerColumn);
        const rowIndex = i % legendRowsPerColumn;
        const x = columnIndex * legendColumnWidth;
        const y = rowIndex * 22;
        
        const legendRow = legendContainer
          .append('g')
          .attr('transform', `translate(${x}, ${y})`)
          .style('cursor', 'pointer')
          .on('click', () => {
            setTagVisibility(prev => ({
              ...prev,
              [tagData.tag]: prev[tagData.tag] === false ? true : false
            }));
          });

        // チェックボックス
        legendRow
          .append('rect')
          .attr('x', 0)
          .attr('y', -8)
          .attr('width', 14)
          .attr('height', 14)
          .attr('fill', isVisible ? 'white' : '#ddd')
          .attr('stroke', '#333')
          .attr('stroke-width', 1)
          .attr('rx', 2);

        if (isVisible) {
          legendRow
            .append('path')
            .attr('d', 'M 3 -3 L 6 0 L 11 -5')
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', 2)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round');
        }

        // 折れ線のサンプル
        legendRow
          .append('line')
          .attr('x1', 18)
          .attr('x2', 38)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('stroke', colorScale(i.toString()))
          .attr('stroke-width', 2)
          .attr('opacity', isVisible ? 1 : 0.3);

        // タグ名（件数付き）
        legendRow
          .append('text')
          .attr('x', 42)
          .attr('y', 4)
          .attr('font-size', '12px')
          .attr('fill', isVisible ? '#333' : '#999')
          .text(`${tagData.tag} (${tagData.totalCount})`);
      });
    }
  }, [papers, tagVisibility]);

  if (loading) {
    return (
      <div className="all-papers-statistics">
        <div className="all-papers-statistics-loading">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  const hasTags = papers.some(p => p.tags && p.tags.length > 0);
  const hasVenues = papers.some(p => p.venue);
  const hasYears = papers.some(p => p.year !== undefined && p.year !== null);
  const hasAuthors = papers.some(p => p.authors && p.authors.length > 0);

  return (
    <div className="all-papers-statistics">
      <div className="all-papers-statistics-header">
        <h1>📊 全論文統計情報</h1>
        <p className="all-papers-statistics-subtitle">全{papers.length}件の論文の統計情報</p>
      </div>

      <div className="all-papers-statistics-content">
        {hasTags && (
          <div className="all-papers-statistics-chart">
            <h3 className="all-papers-statistics-chart-title">タグ分布</h3>
            <svg ref={tagStatsRef} />
          </div>
        )}
        {hasVenues && (
          <div className="all-papers-statistics-chart">
            <h3 className="all-papers-statistics-chart-title">カンファレンス分布</h3>
            <svg ref={venueStatsRef} />
          </div>
        )}
        {hasYears && (
          <div className="all-papers-statistics-chart">
            <h3 className="all-papers-statistics-chart-title">年分布</h3>
            <svg ref={yearStatsRef} />
          </div>
        )}
        {hasAuthors && (
          <div className="all-papers-statistics-chart">
            <h3 className="all-papers-statistics-chart-title">著者分布</h3>
            <svg ref={authorStatsRef} />
          </div>
        )}
      </div>

      {hasTags && hasYears && (
        <div className="all-papers-statistics-line-chart">
          <h3 className="all-papers-statistics-chart-title">年ごとのタグ別論文数</h3>
          <p className="all-papers-statistics-line-chart-hint">凡例のチェックボックスでタグの表示/非表示を切り替えられます</p>
          <div className="all-papers-statistics-line-chart-controls">
            <button
              className="all-papers-statistics-line-chart-button"
              onClick={() => {
                const allVisible: Record<string, boolean> = {};
                Object.keys(tagVisibility).forEach(tag => {
                  allVisible[tag] = true;
                });
                setTagVisibility(allVisible);
              }}
            >
              全てチェック
            </button>
            <button
              className="all-papers-statistics-line-chart-button"
              onClick={() => {
                const allHidden: Record<string, boolean> = {};
                Object.keys(tagVisibility).forEach(tag => {
                  allHidden[tag] = false;
                });
                setTagVisibility(allHidden);
              }}
            >
              全てチェック解除
            </button>
          </div>
          <svg ref={lineChartRef} />
        </div>
      )}
    </div>
  );
};

export default AllPapersStatistics;

