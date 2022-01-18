/**
 * @module Link/helper
 * @description
 * A set of helper methods to manipulate/create links.
 */
import { LINE_TYPES, SELF_LINK_DIRECTION } from "./link.const";

/**
 * Computes radius value for a straight line.
 * @returns {number} radius for straight line.
 * @memberof Link/helper
 */
function straightLineRadius() {
  return 0;
}

/**
 * Computes radius for a smooth curve effect.
 * @param {number} x1 - x value for point 1
 * @param {number} y1 - y value for point 1
 * @param {number} x2 - y value for point 2
 * @param {number} y2 - y value for point 2
 * @returns{number} value of radius.
 * @memberof Link/helper
 */
function smoothCurveRadius(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes radius value for a full curve (semi circumference).
 * @returns {number} radius for full curve.
 * @memberof Link/helper
 */
function fullCurveRadius() {
  return 1;
}

const RADIUS_STRATEGIES = {
  [LINE_TYPES.STRAIGHT]: straightLineRadius,
  [LINE_TYPES.CURVE_SMOOTH]: smoothCurveRadius,
  [LINE_TYPES.CURVE_FULL]: fullCurveRadius,
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
    const tightestArcDeviation = length * parallelSpread * Math.pow(0.85, Math.floor(parallelCount / 2));
    const deviationSize =
      (parallelCount % 2 == 0
        ? (() => {
            const mid = parallelCount / 2;
            return parallelIdx - mid + 0.5;
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
  const calcRadiusFn = getRadiusStrategy(validType);

  const restOfLinkPoints = [...breakPoints, targetCoords];
  const restOfLinkPath = restOfLinkPoints
    .map(({ x, y }, i) => {
      const { x: px, y: py } = i > 0 ? restOfLinkPoints[i - 1] : sourceCoords;
      const radius = calcRadiusFn(px, py, x, y);

      return ` A${radius},${radius} 0 0,1 ${x},${y}`;
    })
    .join("");

  return `M${sx},${sy}${restOfLinkPath}`;
}

export { buildLinkPathDefinition };
