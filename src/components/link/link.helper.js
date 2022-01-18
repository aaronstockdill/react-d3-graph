/**
 * @module Link/helper
 * @description
 * A set of helper methods to manipulate/create links.
 */
import { LINE_TYPES, SELF_LINK_DIRECTION } from "./link.const";

/**
 * Computes path value for a straight line.
 * @param {Array.<Object>} points - points being connected
 * @returns {string} path for straight line.
 * @memberof Link/helper
 */
function straightLineRadius(points) {
  return points
    .map((point, i) => {
      let { x, y } = point;
      if (i == 0) {
        return `M${x},${y}`;
      } else {
        return `L${x},${y}`;
      }
    })
    .join(" ");
}

/**
 * Computes path for a smooth curve effect.
 * @param {Array.<Object>} points - points being connected
 * @returns{string} path for a smooth curve.
 * @memberof Link/helper
 */
function smoothCurveRadius(points) {
  return points
    .map((point, i) => {
      const { x, y } = point;
      if (i == 0) {
        return `M${x},${y}`;
      } else {
        const { x: x1, y: y1 } = points[i - 1];
        const dx = x1 - x;
        const dy = y1 - y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        return `A${radius},${radius} 0 0,1 ${x},${y}`;
      }
    })
    .join(" ");
}

/**
 * Computes path value for a full curve (semi circumference).
 * @param {Array.<Object>} points - points being connected
 * @returns {string} path for full curve.
 * @memberof Link/helper
 */
function fullCurveRadius(points) {
  return points
    .map((point, i) => {
      const { x, y } = point;
      if (i == 0) {
        return `M${x},${y}`;
      } else {
        return `A1,1 0 0,1 ${x},${y}`;
      }
    })
    .join(" ");
}

function smooth3(p0, p1, p2) {
  const length02 = Math.sqrt(Math.pow(p2.x - p0.x, 2) + Math.pow(p2.y - p0.y, 2));
  const length01 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
  const length12 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const d = { x: (p2.x - p0.x) / length02, y: (p2.y - p0.y) / length02 };
  const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const n1 = { x: (p0.y - p1.y) / length01, y: (p1.x - p0.x) / length01 };
  const n2 = { x: (p1.y - p2.y) / length12, y: (p2.x - p1.x) / length12 };
  const l1 = { x: p1.x - mid1.x, y: p1.y - mid1.y };
  const l2 = { x: p2.x - mid2.x, y: p2.y - mid2.y };
  const s1 = (n1.x * l1.y - n1.y * l1.x) / (d.x * n1.y - d.y * n1.x);
  const s2 = (n2.x * l2.y - n2.y * l2.x) / (d.x * n2.y - d.y * n2.x);
  const q1 = { x: p1.x + d.x * s1, y: p1.y + d.y * s1 };
  const q2 = { x: p1.x - d.x * s2, y: p1.y - d.y * s2 };
  return [`M${p0.x},${p0.y}`, `Q${q1.x},${q1.y} ${p1.x},${p1.y}`, `Q${q2.x},${q2.y} ${p2.x},${p2.y}`].join(" ");
}

/**
 * Computes path value for a smooth Catmull-Rom curve through all the points.
 * @param {Array.<Object>} points - points being connected
 * @returns {string} path for Catmull-Rom curve.
 * @memberof Link/helper
 */
function catmullRom(points) {
  if (points.length === 2) {
    return straightLineRadius(points);
  }
  if (points.length === 3) {
    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];
    return smooth3(p0, p1, p2);
  }
  const alpha = 0.5;
  const fin = points.length - 1;
  const knots = [0];
  for (let i = 1; i < fin; i++) {
    const { x: x1, y: y1 } = points[i];
    const { x: x2, y: y2 } = points[i + 1];
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const t = Math.pow(length, alpha) + knots[knots.length - 1];
  }
  return points
    .map((point, i) => {
      const { x, y } = point;
      if (i == 0) {
        return `M${x},${y}`;
      } else if (i == 1 || i == fin) {
        return `T${x},${y}`;
      } else {
        const p0 = points[i - 2];
        const p1 = points[i - 1];
        const p2 = point;
        const p3 = points[i + 1];

        const t0 = knots[i - 2];
        const t1 = knots[i - 1];
        const t2 = knots[i];
        const t3 = knotss[i + 1];

        const c1 = (t2 - t1) / (t2 - t0);
        const c2 = (t1 - t0) / (t2 - t0);
        const d1 = (t3 - t2) / (t3 - t1);
        const d2 = (t2 - t1) / (t3 - t1);

        const m1 = {
          x: (t2 - t1) * ((c1 * (p1.x - p0.x)) / (t1 - t0) + (c2 * (p2.x - p1.x)) / (t2 - t1)),
          y: (t2 - t1) * ((c1 * (p1.y - p0.y)) / (t1 - t0) + (c2 * (p2.y - p1.y)) / (t2 - t1)),
        };
        const m2 = {
          x: (t2 - t1) * ((d1 * (p2.x - p1.x)) / (t2 - t1) + (d2 * (p3.x - p2.x)) / (t3 - t2)),
          y: (t2 - t1) * ((d1 * (p2.y - p1.y)) / (t2 - t1) + (d2 * (p3.y - p2.y)) / (t3 - t2)),
        };

        const q1 = {
          x: p1.x + m1.x / 3,
          y: p1.y + m1.y / 3,
        };
        const q2 = {
          x: p2.x - m2.x / 3,
          y: p2.y - m2.y / 3,
        };
        return `C${q1.x},${q1.y} ${q2.x},${q2.y} ${x}${y}`;
      }
    })
    .join(" ");
}

const RADIUS_STRATEGIES = {
  [LINE_TYPES.STRAIGHT]: straightLineRadius,
  [LINE_TYPES.CURVE_SMOOTH]: smoothCurveRadius,
  [LINE_TYPES.CURVE_FULL]: fullCurveRadius,
  [LINE_TYPES.CATMULL_ROM]: catmullRom,
};

/**
 * Get a strategy to compute line radius.<br/>
 * *CURVE_SMOOTH* type inspired by {@link http://bl.ocks.org/mbostock/1153292|mbostock - Mobile Patent Suits}.
 * @param {string} [type=LINE_TYPES.STRAIGHT] type of curve to get radius strategy from.
 * @returns {Function} a function that calculates a radius
 * to match curve type expectation. Fallback is the straight line.
 * @memberof Link/helper
 */
function getRadiusStrategy(type) {
  return RADIUS_STRATEGIES[type] || RADIUS_STRATEGIES[LINE_TYPES.STRAIGHT];
}

/**
 * This method returns the path definition for a given link base on the line type
 * and the link source and target.
 * {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d|d attribute mdn}
 * @param {Object} sourceCoords - link sourceCoords
 * @param {Object} targetCoords - link targetCoords
 * @param {string} type - the link line type
 * @param {Array.<Object>} breakPoints - additional set of points that the link will cross
 * @param {string|number} sourceId - the source node id
 * @param {string|number} targetId - the target node id
 * @param {string} selfLinkDirection - the direction that self links will be rendered in
 * @returns {string} the path definition for the requested link
 * @memberof Link/helper
 */
function buildLinkPathDefinition(
  sourceCoords = {},
  targetCoords = {},
  type = LINE_TYPES.STRAIGHT,
  breakPoints = [],
  sourceId,
  targetId,
  parallelIdx,
  parallelCount,
  parallelSpread,
  selfLinkDirection = SELF_LINK_DIRECTION.TOP_RIGHT
) {
  const { x: sx, y: sy } = sourceCoords;
  const { x: tx, y: ty } = targetCoords;
  if (sourceId === targetId && sx === tx && sy === ty) {
    switch (selfLinkDirection) {
      case SELF_LINK_DIRECTION.TOP_LEFT:
        return `M${sx},${sy} A40,30 45 1,1 ${tx + 1},${ty - 1}`;
      case SELF_LINK_DIRECTION.BOTTOM_LEFT:
        return `M${sx},${sy} A40,30 -45 1,1 ${tx - 1},${ty - 1}`;
      case SELF_LINK_DIRECTION.BOTTOM_RIGHT:
        return `M${sx},${sy} A40,30 45 1,1 ${tx - 1},${ty + 1}`;
      default:
        return `M${sx},${sy} A40,30 -45 1,1 ${tx + 1},${ty + 1}`;
    }
  }

  // If they're parallel but with break-points, assume author knows what they're doing.
  if (breakPoints.length === 0 && parallelCount > 1) {
    const length = Math.sqrt(Math.pow(Math.abs(sx - tx), 2) + Math.pow(Math.abs(sy - ty), 2));
    const tightestArcDeviation = length * parallelSpread;
    const deviationSize =
      (parallelCount % 2 == 0
        ? (() => {
            const mid = parallelCount / 2;
            if (parallelIdx < mid) {
              return parallelIdx - mid;
            } else {
              return parallelIdx - mid + 1;
            }
          })()
        : (() => {
            const mid = (parallelCount - 1) / 2;
            return parallelIdx - mid;
          })()) * tightestArcDeviation;
    if (Math.abs(deviationSize) < 0.00001) {
      breakPoints = [];
    } else {
      const midPt = { x: (sx + tx) / 2, y: (sy + ty) / 2 };
      const dirVec = { x: (sy - ty) / length, y: (tx - sx) / length };
      const arcPt = { x: midPt.x + dirVec.x * deviationSize, y: midPt.y + dirVec.y * deviationSize };
      breakPoints = [arcPt];
    }
  }

  const validType = LINE_TYPES[type] || LINE_TYPES.STRAIGHT;
  const calcPathFn = getRadiusStrategy(validType);

  const linkPoints = [sourceCoords, ...breakPoints, targetCoords];
  const linkPath = calcPathFn(linkPoints);

  return `${linkPath}`;
}

export { buildLinkPathDefinition };
