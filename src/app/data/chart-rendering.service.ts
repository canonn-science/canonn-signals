import { Injectable } from '@angular/core';

/** A ring (or body-orbit pseudo-ring) plotted on the Roche-limit chart. */
export interface RocheChartRing {
  name: string;
  innerRadius: number;
  outerRadius: number;
  type: string;
  density: number;
}

/** Data for the Roche-limit chart: limit curves vs. particle density plus ring positions. */
export interface RocheChartData {
  parentName: string;
  ringName: string;
  densityRange: number[];
  rigidLimits: number[];
  fluidLimits: number[];
  rings: RocheChartRing[];
  primaryRadius: number;
  isBody: boolean;
}

/** A ring drawn on the Hill-sphere shepherding diagram. */
export interface HillChartRing {
  name: string;
  innerRadius: number;
  outerRadius: number;
  type: string;
}

/** Data for the shepherding Hill-sphere orbital diagram. */
export interface HillChartData {
  parentName: string;
  bodyName: string;
  parentRadius: number;
  outermostRingRadius: number;
  bodyOrbitalRadius: number;
  bodyPeriapsis: number;
  bodyApoapsis: number;
  hillRadius: number;
  withinRings: boolean;
  isFirstOutside: boolean;
  rings: HillChartRing[];
  bodyRadius: number;
  shepherdStatus: 'shepherd' | 'inner' | 'none';
}

/**
 * Renders the Roche-limit, shepherding Hill-sphere and neutron-star jet-angle charts
 * onto a 2D canvas. Pure drawing logic extracted from SystemBodyComponent: callers
 * pass the target canvas and the prepared chart data, keeping all imperative canvas
 * code out of the component.
 */
@Injectable({ providedIn: 'root' })
export class ChartRenderingService {
  drawRocheChart(canvas: HTMLCanvasElement, data: RocheChartData): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Find data ranges - use log scale for Y-axis
    const minDensity = Math.min(...data.densityRange);
    const maxDensity = Math.max(...data.densityRange);

    // Get all distances including ring positions for proper scaling
    const allDistances = [...data.rigidLimits, ...data.fluidLimits];
    data.rings.forEach((ring) => {
      allDistances.push(ring.innerRadius);
      allDistances.push(ring.outerRadius);
    });
    const maxDistance = Math.max(...allDistances);
    // Start slightly below the minimum for visibility, but never at/below 0 — the
    // Y-axis is logarithmic, so a 0 (e.g. a ring with no radius) would make
    // log10(minDistance) = -Infinity and turn every plotted point into NaN.
    const minDistance = Math.max(Math.min(...allDistances) * 0.5, 1);

    // Helper functions - logarithmic Y scale
    const scaleX = (density: number) => padding + ((density - minDensity) / (maxDensity - minDensity)) * chartWidth;
    const scaleY = (distance: number) => {
      if (distance <= 0) return height - padding;
      const logMin = Math.log10(minDistance);
      const logMax = Math.log10(maxDistance);
      const logDist = Math.log10(distance);
      return height - padding - ((logDist - logMin) / (logMax - logMin)) * chartHeight;
    };

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw logarithmic grid lines with labels
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const logMin = Math.log10(minDistance);
    const logMax = Math.log10(maxDistance);

    // Draw grid at powers of 10
    for (let logVal = Math.ceil(logMin); logVal <= Math.floor(logMax); logVal++) {
      const distance = Math.pow(10, logVal);
      const y = scaleY(distance);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw rigid limit line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.densityRange.length; i++) {
      const x = scaleX(data.densityRange[i]);
      const y = scaleY(data.rigidLimits[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw fluid limit line
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.densityRange.length; i++) {
      const x = scaleX(data.densityRange[i]);
      const y = scaleY(data.fluidLimits[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw ring positions as horizontal bands with vertical density line
    const ringColors = ['#51cf66', '#ffa94d', '#748ffc', '#ff6b6b', '#20c997'];
    data.rings.forEach((ring, index) => {
      const color = ringColors[index % ringColors.length];
      const x = scaleX(ring.density);
      const yInner = scaleY(ring.innerRadius);
      const yOuter = scaleY(ring.outerRadius);

      // Draw translucent horizontal bar for ring extent
      const rgb = color === '#51cf66' ? '81, 207, 102' :
        color === '#ffa94d' ? '255, 169, 77' :
          color === '#748ffc' ? '116, 143, 252' :
            color === '#ff6b6b' ? '255, 107, 107' : '32, 201, 151';
      ctx.fillStyle = `rgba(${rgb}, 0.2)`;
      ctx.fillRect(padding, yOuter, chartWidth, yInner - yOuter);

      // Draw horizontal lines at inner and outer radius
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, yInner);
      ctx.lineTo(width - padding, yInner);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padding, yOuter);
      ctx.lineTo(width - padding, yOuter);
      ctx.stroke();

      // Draw vertical line at the assumed density
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw density marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, height - padding, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Label the density line
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x, padding + 15 + (index * 18));
      ctx.fillText(`${ring.density.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/m³`, 0, 0);
      ctx.restore();
    });

    // Draw axis labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const density = minDensity + ((maxDensity - minDensity) / 5) * i;
      const x = scaleX(density);
      ctx.fillText(density.toFixed(0), x, height - padding + 20);
    }

    // Y-axis labels (logarithmic scale - powers of 10)
    ctx.textAlign = 'right';
    for (let logVal = Math.ceil(logMin); logVal <= Math.floor(logMax); logVal++) {
      const distance = Math.pow(10, logVal);
      const y = scaleY(distance);
      // Format large numbers with scientific notation or comma separation
      let label = distance >= 1000000
        ? (distance / 1000000).toFixed(1) + 'M'
        : distance >= 1000
          ? (distance / 1000).toFixed(0) + 'k'
          : distance.toFixed(0);
      ctx.fillText(label, padding - 10, y + 4);
    }

    // Draw axis titles
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Particle Density (kg/m³)', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Roche Limit Distance (km, log scale)', 0, 0);
    ctx.restore();

    // Draw legend
    const legendX = width - padding - 120;
    const legendY = padding + 20;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 30, legendY);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Rigid limit', legendX + 35, legendY + 4);

    ctx.strokeStyle = '#4dabf7';
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 20);
    ctx.lineTo(legendX + 30, legendY + 20);
    ctx.stroke();
    ctx.fillText('Fluid limit', legendX + 35, legendY + 24);

    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 40);
    ctx.lineTo(legendX + 30, legendY + 40);
    ctx.stroke();
    const positionLabel = data.isBody ? 'Body position' : 'Ring position';
    ctx.fillText(positionLabel, legendX + 35, legendY + 44);
  }

  drawShepherdingHillChart(canvas: HTMLCanvasElement, data: HillChartData): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const centerX = 80; // Bottom left origin
    const centerY = height - 80;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Determine scale - find minimum and maximum radii from all features
    let minRadius = data.parentRadius;
    const maxRadius = Math.max(
      data.outermostRingRadius * 1.1,
      data.bodyApoapsis + data.hillRadius
    );

    // Find the smallest inner radius from rings for better scaling
    if (data.rings && data.rings.length > 0) {
      const smallestInner = Math.min(...data.rings.map((r) => r.innerRadius || minRadius));
      minRadius = Math.min(minRadius, smallestInner * 0.8); // Start slightly below smallest ring
    }

    // Use logarithmic scale for better visibility of inner rings
    const minLog = Math.log10(Math.max(minRadius, 1));
    const maxLog = Math.log10(maxRadius);
    const availableRadius = Math.min(width - centerX - 40, centerY - 40); // Quarter circle space

    // Helper to convert km to pixels using logarithmic scale
    const toPixels = (km: number) => {
      if (km <= 0) return 0;
      const logValue = Math.log10(km);
      return ((logValue - minLog) / (maxLog - minLog)) * availableRadius;
    };

    // Draw parent body at origin (bottom left)
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    const parentRadiusPx = toPixels(data.parentRadius);
    ctx.arc(centerX, centerY, Math.max(parentRadiusPx, 8), 0, Math.PI * 2);
    ctx.fill();

    // Label parent
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Parent', centerX + 10, centerY - 5);

    // Draw rings as quarter-circle arcs (top-right quadrant from bottom-left origin)
    // Use a single green colour for all rings to match the legend and improve
    // visibility when rings are very thin.
    const startAngle = -Math.PI / 2; // Start at top (12 o'clock from origin)
    const endAngle = 0; // End at right (3 o'clock from origin)
    const ringColor = '#51cf66';

    data.rings.forEach((ring, index) => {
      const innerRadiusPx = toPixels(ring.innerRadius);
      const outerRadiusPx = toPixels(ring.outerRadius);

      // Draw ring as two arcs (inner and outer)
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;

      // Outer arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadiusPx, startAngle, endAngle);
      ctx.stroke();

      // Inner arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadiusPx, startAngle, endAngle);
      ctx.stroke();

      // Fill between arcs with transparency
      ctx.fillStyle = 'rgba(81, 207, 102, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadiusPx, startAngle, endAngle);
      ctx.lineTo(centerX + outerRadiusPx * Math.cos(endAngle), centerY + outerRadiusPx * Math.sin(endAngle));
      ctx.arc(centerX, centerY, outerRadiusPx, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();

      // Label ring at 45 degrees
      ctx.fillStyle = ringColor;
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      const labelAngle = -Math.PI / 4; // 45 degrees
      const labelRadius = (innerRadiusPx + outerRadiusPx) / 2;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);
      ctx.fillText(`R${index + 1}`, labelX, labelY);
    });

    // Draw body orbital position as a solid quarter arc
    const bodyOrbitRadiusPx = toPixels(data.bodyOrbitalRadius);
    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bodyOrbitRadiusPx, startAngle, endAngle);
    ctx.stroke();

    // Draw body position marker at 45 degrees
    const bodyAngle = -Math.PI / 4;
    const bodyX = centerX + bodyOrbitRadiusPx * Math.cos(bodyAngle);
    const bodyY = centerY + bodyOrbitRadiusPx * Math.sin(bodyAngle);
    ctx.fillStyle = '#4c6ef5';
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Draw Hill sphere limits as dashed quarter arcs on either side
    const hillInnerRadiusPx = toPixels(Math.max(data.bodyOrbitalRadius - data.hillRadius, data.parentRadius));
    const hillOuterRadiusPx = toPixels(data.bodyOrbitalRadius + data.hillRadius);

    ctx.strokeStyle = '#f03e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    // Inner Hill limit
    if (data.bodyOrbitalRadius - data.hillRadius > data.parentRadius) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, hillInnerRadiusPx, startAngle, endAngle);
      ctx.stroke();
    }

    // Outer Hill limit
    ctx.beginPath();
    ctx.arc(centerX, centerY, hillOuterRadiusPx, startAngle, endAngle);
    ctx.stroke();

    ctx.setLineDash([]);

    // Add distance markers with logarithmic spacing
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);

    // Calculate nice logarithmic intervals
    const logRange = maxLog - minLog;
    const numMarkers = 6;

    for (let i = 0; i <= numMarkers; i++) {
      const logValue = minLog + (logRange / numMarkers) * i;
      const dist = Math.pow(10, logValue);
      const radiusPx = toPixels(dist);

      if (radiusPx > parentRadiusPx && radiusPx < availableRadius) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radiusPx, startAngle, endAngle);
        ctx.stroke();

        // Label at the right edge
        ctx.fillStyle = '#999';
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        const label = dist >= 1000000
          ? (dist / 1000000).toFixed(1) + 'M km'
          : dist >= 1000
            ? (dist / 1000).toFixed(0) + 'k km'
            : dist.toFixed(0) + ' km';
        ctx.fillText(label, centerX + radiusPx + 5, centerY);
      }
    }

    ctx.setLineDash([]);

    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Orbital View - Shepherding Analysis (Log Scale)', 20, 25);

    // Draw legend in top right
    const legendX = width - 180;
    const legendY = 50;

    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';

    // Ring legend
    ctx.fillStyle = 'rgba(81, 207, 102, 0.3)';
    ctx.fillRect(legendX, legendY, 15, 10);
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 2;
    ctx.strokeRect(legendX, legendY, 15, 10);
    ctx.fillStyle = '#333';
    ctx.fillText('Ring boundaries', legendX + 20, legendY + 9);

    // Body orbit
    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 30);
    ctx.lineTo(legendX + 15, legendY + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('Body orbit', legendX + 20, legendY + 34);

    // Hill sphere
    ctx.strokeStyle = '#f03e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 55);
    ctx.lineTo(legendX + 15, legendY + 55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#333';
    ctx.fillText('Hill sphere extent', legendX + 20, legendY + 59);

    // Parent body
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.arc(legendX + 7, legendY + 80, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillText('Parent body', legendX + 20, legendY + 84);
  }
}
