const WIDTH = 600;
const HEIGHT = 400;
const MARGIN = { top: 60, right: 20, bottom: 40, left: 50 };
const N_POINTS = 10000;

const svg = document.getElementById("chi2-svg");
const dofInput = document.getElementById("dof-input");
const alphaInput = document.getElementById("alpha-input");

function factorialInt(n) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function gammaIntOrHalf(alpha) {
    const twoAlpha = Math.round(alpha * 2);

    if (twoAlpha % 2 === 0) {
        const n = twoAlpha / 2;
        if (n <= 1) return 1;
        return factorialInt(n - 1);
    }

    const n = (twoAlpha - 1) / 2;
    const numerator = factorialInt(2 * n);
    const denominator = Math.pow(4, n) * factorialInt(n);
    return (numerator / denominator) * Math.sqrt(Math.PI);
}

function chiSquarePdf(x, k) {
    if (x <= 0) return 0;
    const alpha = k / 2;
    const coef = 1 / (Math.pow(2, alpha) * gammaIntOrHalf(alpha));
    return coef * Math.pow(x, alpha - 1) * Math.exp(-x / 2);
}

function buildData(k) {
    const sigma = Math.sqrt(2 * k);
    const xMin = 0;
    const xMax = Math.max(30, k + 10 * sigma);
    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const dx = (xMax - xMin) / N_POINTS;
    const data = [];
    let maxY = 0;

    for (let i = 0; i <= N_POINTS; i++) {
        const x = xMin + dx * i;
        const y = chiSquarePdf(x, k);
        if (y > maxY) maxY = y;
        data.push({ x, y });
    }

    function xScale(x) {
        return MARGIN.left + ((x - xMin) / (xMax - xMin)) * innerWidth;
    }

    function yScale(y) {
        if (maxY === 0) return MARGIN.top + innerHeight;
        return MARGIN.top + innerHeight - (y / maxY) * innerHeight;
    }

    return {
        data,
        dx,
        xMin,
        xMax,
        maxY,
        innerWidth,
        innerHeight,
        xScale,
        yScale,
    };
}

function clearSvg() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function drawAxes(innerWidth, innerHeight) {
    const axisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxis.setAttribute("x1", MARGIN.left);
    xAxis.setAttribute("y1", MARGIN.top + innerHeight);
    xAxis.setAttribute("x2", MARGIN.left + innerWidth);
    xAxis.setAttribute("y2", MARGIN.top + innerHeight);
    xAxis.setAttribute("stroke", "black");
    axisGroup.appendChild(xAxis);

    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxis.setAttribute("x1", MARGIN.left);
    yAxis.setAttribute("y1", MARGIN.top);
    yAxis.setAttribute("x2", MARGIN.left);
    yAxis.setAttribute("y2", MARGIN.top + innerHeight);
    yAxis.setAttribute("stroke", "black");
    axisGroup.appendChild(yAxis);

    const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLabel.setAttribute("x", MARGIN.left + innerWidth / 2);
    xLabel.setAttribute("y", HEIGHT - 5);
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.textContent = "x";
    axisGroup.appendChild(xLabel);

    svg.appendChild(axisGroup);
}

function drawCurve(data, xScale, yScale) {
    let d = "";
    data.forEach((pt, i) => {
        const sx = xScale(pt.x);
        const sy = yScale(pt.y);
        d += (i === 0 ? "M" : "L") + sx + " " + sy + " ";
    });

    const curvePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    curvePath.setAttribute("d", d.trim());
    curvePath.setAttribute("fill", "none");
    curvePath.setAttribute("stroke", "black");
    curvePath.setAttribute("stroke-width", "2");
    svg.appendChild(curvePath);
}

function computeCriticalValue(data, dx, alphaPercent) {
    let alpha = alphaPercent / 100;
    if (!(alpha > 0 && alpha < 1)) alpha = 0.05;

    const cdfValues = new Array(N_POINTS + 1).fill(0);
    let area = 0;
    for (let i = 1; i <= N_POINTS; i++) {
        const yPrev = data[i - 1].y;
        const yCurr = data[i].y;
        area += 0.5 * (yPrev + yCurr) * dx;
        cdfValues[i] = area;
    }
    const totalArea = area;
    const cdfNorm = cdfValues.map(v => v / totalArea);
    const targetLower = 1 - alpha;

    let critIndex = N_POINTS;
    for (let i = 0; i <= N_POINTS; i++) {
        if (cdfNorm[i] >= targetLower) {
            critIndex = i;
            break;
        }
    }

    let xCrit;
    if (critIndex === 0) {
        xCrit = data[0].x;
    } else {
        const cdfPrev = cdfNorm[critIndex - 1];
        const cdfCurr = cdfNorm[critIndex];
        const t = (targetLower - cdfPrev) / (cdfCurr - cdfPrev || 1);
        const xPrev = data[critIndex - 1].x;
        const xCurr = data[critIndex].x;
        xCrit = xPrev + (xCurr - xPrev) * Math.min(Math.max(t, 0), 1);
    }

    return { xCrit, critIndex };
}

function drawRejectionRegion(data, xScale, yScale, xCrit, critIndex, xMax, baseY) {
    let dReject = "";
    dReject += "M " + xScale(xCrit) + " " + baseY + " ";
    for (let i = critIndex; i <= N_POINTS; i++) {
        const sx = xScale(data[i].x);
        const sy = yScale(data[i].y);
        dReject += "L " + sx + " " + sy + " ";
    }
    dReject += "L " + xScale(xMax) + " " + baseY + " Z";

    const rejectPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    rejectPath.setAttribute("d", dReject);
    rejectPath.setAttribute("fill", "lightblue");
    rejectPath.setAttribute("fill-opacity", "0.5");
    rejectPath.setAttribute("stroke", "none");
    svg.appendChild(rejectPath);
}

function drawCriticalMarkers(xScale, xCrit, baseY, alphaPercent) {
    const critLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    critLine.setAttribute("x1", xScale(xCrit));
    critLine.setAttribute("y1", MARGIN.top);
    critLine.setAttribute("x2", xScale(xCrit));
    critLine.setAttribute("y2", baseY);
    critLine.setAttribute("stroke", "black");
    critLine.setAttribute("stroke-dasharray", "4 4");
    svg.appendChild(critLine);

    const critDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    critDot.setAttribute("cx", xScale(xCrit));
    critDot.setAttribute("cy", baseY);
    critDot.setAttribute("r", 4);
    critDot.setAttribute("fill", "black");
    svg.appendChild(critDot);

    const critLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    critLabel.setAttribute("x", xScale(xCrit));
    critLabel.setAttribute("y", baseY + 18);
    critLabel.setAttribute("text-anchor", "middle");
    critLabel.textContent = `χ²の理論値 ≒ ${xCrit.toFixed(3)}`;
    svg.appendChild(critLabel);
}

function computeRejectionCentroid(data, dx, xCrit, critIndex, xMax, xScale, yScale, baseY) {
    let sumW = 0;
    let sumXW = 0;
    for (let i = critIndex + 1; i <= N_POINTS; i++) {
        const yPrev = data[i - 1].y;
        const yCurr = data[i].y;
        const xPrev = data[i - 1].x;
        const xCurr = data[i].x;
        const w = 0.5 * (yPrev + yCurr) * dx;
        const xMid = 0.5 * (xPrev + xCurr);
        sumW += w;
        sumXW += xMid * w;
    }

    let xCenter;
    if (sumW > 0) {
        xCenter = sumXW / sumW;
    } else {
        xCenter = 0.5 * (xCrit + xMax);
    }

    let idxClosest = critIndex;
    for (let i = critIndex; i <= N_POINTS; i++) {
        if (data[i].x >= xCenter) {
            idxClosest = i;
            break;
        }
    }

    const yAtCenter = data[idxClosest].y;
    const svgYCurve = yScale(yAtCenter);
    const yCenter = (baseY + svgYCurve) / 2;

    return {
        xCenter,
        yCenter,
        centerXsvg: xScale(xCenter),
    };
}

function drawRegionLabelAndPointer(centerXsvg, yCenter) {
    const regionLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const regionX = centerXsvg + 30;
    const regionY = yCenter - 24;
    regionLabel.setAttribute("x", regionX);
    regionLabel.setAttribute("y", regionY);
    regionLabel.setAttribute("text-anchor", "middle");
    regionLabel.textContent = "棄却域";
    svg.appendChild(regionLabel);

    const pointerLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    pointerLine.setAttribute("x1", regionX - 10);
    pointerLine.setAttribute("y1", regionY + 4);
    pointerLine.setAttribute("x2", centerXsvg);
    pointerLine.setAttribute("y2", yCenter);
    pointerLine.setAttribute("stroke", "black");
    pointerLine.setAttribute("stroke-width", "1");
    svg.appendChild(pointerLine);
}

function drawTitle(k, alphaPercent) {
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", WIDTH / 2);
    title.setAttribute("y", 25);
    title.setAttribute("text-anchor", "middle");
    title.textContent = `自由度 = ${k}, 有意水準α = ${alphaPercent.toFixed(1)}%`;
    svg.appendChild(title);
}

function drawChiSquare(k, alphaPercent) {
    clearSvg();

    const {
        data,
        dx,
        xMin,
        xMax,
        maxY,
        innerWidth,
        innerHeight,
        xScale,
        yScale,
    } = buildData(k);

    const baseY = MARGIN.top + innerHeight;

    drawAxes(innerWidth, innerHeight);
    drawCurve(data, xScale, yScale);

    const { xCrit, critIndex } = computeCriticalValue(data, dx, alphaPercent);
    drawRejectionRegion(data, xScale, yScale, xCrit, critIndex, xMax, baseY);
    drawCriticalMarkers(xScale, xCrit, baseY, alphaPercent);

    const { xCenter, yCenter, centerXsvg } = computeRejectionCentroid(
        data,
        dx,
        xCrit,
        critIndex,
        xMax,
        xScale,
        yScale,
        baseY,
    );

    drawRegionLabelAndPointer(centerXsvg, yCenter);
    drawTitle(k, alphaPercent);
}

function downloadSvg() {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.match(/^<\?xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\n' + source;
    }

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "chi_square_plot.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function redrawFromInputs() {
    const k = parseInt(dofInput.value, 10);
    const alphaPercent = parseFloat(alphaInput.value);
    if (!isNaN(k) && k > 0 && !isNaN(alphaPercent) && alphaPercent > 0 && alphaPercent < 100) {
        drawChiSquare(k, alphaPercent);
    }
}

document.getElementById("download-btn").addEventListener("click", downloadSvg);
dofInput.addEventListener("input", redrawFromInputs);
alphaInput.addEventListener("input", redrawFromInputs);

drawChiSquare(3, 5);