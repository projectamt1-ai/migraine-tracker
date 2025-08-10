/* charts.js
 *
 * Draws simple charts using the HTML5 Canvas API. The design goal
 * is to provide clear, high‑contrast visualisations without reliance on
 * external libraries. All charts are redrawn whenever new data is
 * available or the containing element changes size.
 */

/**
 * Render all charts into the given container element. The container
 * must contain canvas elements with IDs lineChart, barChart and
 * triggerChart. If not present, they will be created automatically.
 *
 * @param {HTMLElement} container
 * @param {Episode[]} episodes
 */
export function renderCharts(container, episodes) {
  // ensure canvases exist
  let lineCanvas = container.querySelector('#lineChart');
  if (!lineCanvas) {
    lineCanvas = document.createElement('canvas');
    lineCanvas.id = 'lineChart';
    lineCanvas.style.display = 'block';
    lineCanvas.style.maxWidth = '100%';
    container.appendChild(lineCanvas);
  }
  let barCanvas = container.querySelector('#barChart');
  if (!barCanvas) {
    barCanvas = document.createElement('canvas');
    barCanvas.id = 'barChart';
    barCanvas.style.display = 'block';
    barCanvas.style.marginTop = '32px';
    barCanvas.style.maxWidth = '100%';
    container.appendChild(barCanvas);
  }
  let triggerCanvas = container.querySelector('#triggerChart');
  if (!triggerCanvas) {
    triggerCanvas = document.createElement('canvas');
    triggerCanvas.id = 'triggerChart';
    triggerCanvas.style.display = 'block';
    triggerCanvas.style.marginTop = '32px';
    triggerCanvas.style.maxWidth = '100%';
    container.appendChild(triggerCanvas);
  }

  // set canvas sizes based on container width
  const width = container.clientWidth || 600;
  const lineHeight = 200;
  const barHeight = 200;
  const triggerHeight = 200;
  lineCanvas.width = width;
  lineCanvas.height = lineHeight;
  barCanvas.width = width;
  barCanvas.height = barHeight;
  triggerCanvas.width = width;
  triggerCanvas.height = triggerHeight;

  drawLineChart(lineCanvas.getContext('2d'), episodes);
  drawBarChart(barCanvas.getContext('2d'), episodes);
  drawTriggerChart(triggerCanvas.getContext('2d'), episodes);
}

/**
 * Draw line chart of intensity over time (last 90 days).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Episode[]} episodes
 */
function drawLineChart(ctx, episodes) {
  clearCanvas(ctx);
  // filter last 90 days
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const data = episodes
    .filter(ep => new Date(ep.datetime) >= cutoff)
    .map(ep => ({ x: new Date(ep.datetime), y: ep.intensity }))
    .sort((a, b) => a.x - b.x);
  if (data.length === 0) {
    drawCenteredText(ctx, 'No data for last 90 days');
    return;
  }
  const margin = 40;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const chartW = w - margin * 2;
  const chartH = h - margin * 2;
  const minX = Math.min(...data.map(d => d.x.getTime()));
  const maxX = Math.max(...data.map(d => d.x.getTime()));
  const minY = 0;
  const maxY = 10;
  // draw axes
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
  ctx.lineWidth = 1;
  // y axis
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.stroke();
  // y ticks and labels
  ctx.font = '12px sans-serif';
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 0; i <= 10; i += 2) {
    const y = h - margin - (i - minY) / (maxY - minY) * chartH;
    ctx.beginPath();
    ctx.moveTo(margin - 4, y);
    ctx.lineTo(margin, y);
    ctx.stroke();
    ctx.fillText(i.toString(), margin - 28, y + 4);
  }
  // x ticks: show up to 5 evenly spaced dates
  const tickCount = Math.min(data.length, 5);
  for (let i = 0; i < tickCount; i++) {
    const t = minX + ((maxX - minX) * i) / (tickCount - 1);
    const x = margin + ((t - minX) / (maxX - minX)) * chartW;
    ctx.beginPath();
    ctx.moveTo(x, h - margin);
    ctx.lineTo(x, h - margin + 4);
    ctx.stroke();
    const date = new Date(t);
    const label = `${date.getMonth()+1}/${date.getDate()}`;
    ctx.fillText(label, x - 15, h - margin + 16);
  }
  // plot line
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((pt, idx) => {
    const x = margin + ((pt.x.getTime() - minX) / (maxX - minX)) * chartW;
    const y = h - margin - ((pt.y - minY) / (maxY - minY)) * chartH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // draw points
  data.forEach(pt => {
    const x = margin + ((pt.x.getTime() - minX) / (maxX - minX)) * chartW;
    const y = h - margin - ((pt.y - minY) / (maxY - minY)) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // title
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Intensity over last 90 days', margin, margin - 10);
}

/**
 * Draw bar chart of episodes per week (last 12 weeks).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Episode[]} episodes
 */
function drawBarChart(ctx, episodes) {
  clearCanvas(ctx);
  // compute last 12 weeks counts (ending this week)
  const now = new Date();
  // find Monday of this week to align weekly buckets (ISO week)
  const day = now.getDay();
  const monday = new Date(now);
  const diff = (day + 6) % 7; // convert Sunday (0) -> 6
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const weekStarts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - 7 * (11 - i));
    weekStarts.push(d);
  }
  const counts = weekStarts.map(() => 0);
  episodes.forEach(ep => {
    const d = new Date(ep.datetime);
    for (let i = 0; i < weekStarts.length; i++) {
      const start = weekStarts[i];
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      if (d >= start && d < end) {
        counts[i]++;
      }
    }
  });
  const maxCount = Math.max(...counts, 1);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = 40;
  const chartW = w - margin * 2;
  const chartH = h - margin * 2;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1;
  // axes
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.stroke();
  // y ticks (integer counts)
  const maxTick = Math.max(maxCount, 5);
  const step = Math.ceil(maxTick / 5);
  for (let i = 0; i <= maxTick; i += step) {
    const y = h - margin - (i / maxTick) * chartH;
    ctx.beginPath();
    ctx.moveTo(margin - 4, y);
    ctx.lineTo(margin, y);
    ctx.stroke();
    ctx.fillText(i.toString(), margin - 28, y + 4);
  }
  // bars
  const barWidth = chartW / counts.length * 0.6;
  counts.forEach((count, idx) => {
    const x = margin + (idx + 0.2) * (chartW / counts.length);
    const barH = (count / maxTick) * chartH;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary', getComputedStyle(document.documentElement).getPropertyValue('--color-primary'));
    ctx.fillRect(x, h - margin - barH, barWidth, barH);
    // label: show week number or starting date (e.g. M/D)
    const labelDate = weekStarts[idx];
    const label = `${labelDate.getMonth() + 1}/${labelDate.getDate()}`;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
    ctx.font = '10px sans-serif';
    ctx.fillText(label, x - 4, h - margin + 12);
  });
  // title
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Episodes per week (last 12 weeks)', margin, margin - 10);
}

/**
 * Draw horizontal bar chart for trigger frequency (last 30 days).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Episode[]} episodes
 */
function drawTriggerChart(ctx, episodes) {
  clearCanvas(ctx);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = episodes.filter(ep => new Date(ep.datetime) >= cutoff);
  if (recent.length === 0) {
    drawCenteredText(ctx, 'No recent triggers');
    return;
  }
  const freq = {};
  recent.forEach(ep => {
    (ep.triggers || []).forEach(t => {
      const key = t.trim().toLowerCase();
      freq[key] = (freq[key] || 0) + 1;
    });
  });
  const items = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // limit to top 10 triggers
    .map(([name, count]) => ({ label: capitalize(name), count }));
  const maxCount = Math.max(...items.map(i => i.count), 1);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = 40;
  const chartH = h - margin * 2;
  const barHeight = chartH / items.length * 0.6;
  items.forEach((item, idx) => {
    const y = margin + idx * (chartH / items.length);
    const barW = ((item.count) / maxCount) * (w - margin * 2 - 100);
    // bar
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    ctx.fillRect(margin, y + (chartH / items.length - barHeight) / 2, barW, barHeight);
    // label
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
    ctx.font = '12px sans-serif';
    ctx.fillText(item.label, margin + barW + 8, y + chartH / items.length * 0.6);
    // count
    ctx.font = '10px sans-serif';
    ctx.fillText(item.count.toString(), margin - 30, y + chartH / items.length * 0.6);
  });
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Trigger frequency (last 30 days)', margin, margin - 10);
}

// --- utility functions ---
function clearCanvas(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawCenteredText(ctx, text) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}