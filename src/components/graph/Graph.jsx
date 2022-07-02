import React from "react";

import { drag as d3Drag } from "d3-drag";
import { forceLink as d3ForceLink } from "d3-force";
import { zoom as d3Zoom, zoomIdentity as d3ZoomIdentity } from "d3-zoom";
import { select as d3Select, selectAll as d3SelectAll, pointer as d3Pointer } from "d3-selection";
import { range as d3Range } from "d3-array";

import CONST from "./graph.const";
import DEFAULT_CONFIG from "./graph.config";
import ERRORS from "../../err";

import { getTargetLeafConnections, toggleLinksMatrixConnections, toggleLinksConnections } from "./collapse.helper";
import { Selection } from "./selection.helper";
import {
  updateNodeHighlightedValue,
  checkForGraphConfigChanges,
  checkForGraphElementsChanges,
  getCenterAndZoomTransformation,
  initializeGraphState,
  initializeNodes,
  isPositionInBounds,
} from "./graph.helper";
import { renderGraph } from "./graph.renderer";
import { merge, debounce, throwErr } from "../../utils";

/**
 * Graph component is the main component for react-d3-graph components, its interface allows its user
 * to build the graph once the user provides the data, configuration (optional) and callback interactions (also optional).
 * The code for the [live example](https://danielcaldas.github.io/react-d3-graph/sandbox/index.html)
 * can be consulted [here](https://github.com/danielcaldas/react-d3-graph/blob/master/sandbox/Sandbox.jsx)
 * @example
 * import { Graph } from 'react-d3-graph';
 *
 * // graph payload (with minimalist structure)
 * const data = {
 *     nodes: [
 *       {id: 'Harry'},
 *       {id: 'Sally'},
 *       {id: 'Alice'}
 *     ],
 *     links: [
 *         {source: 'Harry', target: 'Sally'},
 *         {source: 'Harry', target: 'Alice'},
 *     ]
 * };
 *
 * // the graph configuration, you only need to pass down properties
 * // that you want to override, otherwise default ones will be used
 * const myConfig = {
 *     nodeHighlightBehavior: true,
 *     node: {
 *         color: 'lightgreen',
 *         size: 120,
 *         highlightStrokeColor: 'blue'
 *     },
 *     link: {
 *         highlightColor: 'lightblue'
 *     }
 * };
 *
 * // Callback to handle click on the graph.
 * // @param {Object} event click dom event
 * const onClickGraph = function(event) {
 *      window.alert('Clicked the graph background');
 * };
 *
 * const onClickNode = function(nodeId, node) {
 *      window.alert('Clicked node ${nodeId} in position (${node.x}, ${node.y})');
 * };
 *
 * const onDoubleClickNode = function(nodeId, node) {
 *      window.alert('Double clicked node ${nodeId} in position (${node.x}, ${node.y})');
 * };
 *
 * const onRightClickNode = function(event, nodeId, node) {
 *      window.alert('Right clicked node ${nodeId} in position (${node.x}, ${node.y})');
 * };
 *
 * const onMouseOverNode = function(nodeId, node) {
 *      window.alert(`Mouse over node ${nodeId} in position (${node.x}, ${node.y})`);
 * };
 *
 * const onMouseOutNode = function(nodeId, node) {
 *      window.alert(`Mouse out node ${nodeId} in position (${node.x}, ${node.y})`);
 * };
 *
 * const onClickLink = function(source, target) {
 *      window.alert(`Clicked link between ${source} and ${target}`);
 * };
 *
 * const onRightClickLink = function(event, source, target) {
 *      window.alert('Right clicked link between ${source} and ${target}');
 * };
 *
 * const onMouseOverLink = function(source, target) {
 *      window.alert(`Mouse over in link between ${source} and ${target}`);
 * };
 *
 * const onMouseOutLink = function(source, target) {
 *      window.alert(`Mouse out link between ${source} and ${target}`);
 * };
 *
 * const onNodePositionChange = function(nodeId, x, y) {
 *      window.alert(`Node ${nodeId} moved to new position x= ${x} y= ${y}`);
 * };
 *
 * // Callback that's called whenever the graph is zoomed in/out
 * // @param {number} previousZoom the previous graph zoom
 * // @param {number} newZoom the new graph zoom
 * const onZoomChange = function(previousZoom, newZoom) {
 *      window.alert(`Graph is now zoomed at ${newZoom} from ${previousZoom}`);
 * };
 *
 *
 * <Graph
 *      id='graph-id' // id is mandatory, if no id is defined rd3g will throw an error
 *      data={data}
 *      config={myConfig}
 *      onClickGraph={onClickGraph}
 *      onClickNode={onClickNode}
 *      onDoubleClickNode={onDoubleClickNode}
 *      onRightClickNode={onRightClickNode}
 *      onClickLink={onClickLink}
 *      onRightClickLink={onRightClickLink}
 *      onMouseOverNode={onMouseOverNode}
 *      onMouseOutNode={onMouseOutNode}
 *      onMouseOverLink={onMouseOverLink}
 *      onMouseOutLink={onMouseOutLink}
 *      onNodePositionChange={onNodePositionChange}
 *      onZoomChange={onZoomChange}/>
 */
export default class Graph extends React.Component {
  /**
   * Obtain a set of properties which will be used to perform the focus and zoom animation if
   * required. In case there's not a focus and zoom animation in progress, it should reset the
   * transition duration to zero and clear transformation styles.
   * @returns {Object} - Focus and zoom animation properties.
   */
  _generateFocusAnimationProps = () => {
    // In case an older animation was still not complete, clear previous timeout to ensure the new one is not cancelled
    if (this.state.enableFocusAnimation) {
      if (this.focusAnimationTimeout) {
        clearTimeout(this.focusAnimationTimeout);
      }

      this.focusAnimationTimeout = setTimeout(
        () => this.setState({ enableFocusAnimation: false }),
        this.state.config.focusAnimationDuration * 1000
      );
    }

    const transitionDuration = this.state.enableFocusAnimation ? this.state.config.focusAnimationDuration : 0;

    return {
      style: { transitionDuration: `${transitionDuration}s` },
      transform: this.state.focusTransformation,
    };
  };

  /**
   * This method runs {@link d3-force|https://github.com/d3/d3-force}
   * against the current graph.
   * @returns {undefined}
   */
  _graphLinkForceConfig() {
    const forceLink = d3ForceLink(this.state.d3Links)
      .id((l) => l.id)
      .distance(this.state.config.d3.linkLength)
      .strength(this.state.config.d3.linkStrength);

    this.state.simulation.force(CONST.LINK_CLASS_NAME, forceLink);
  }

  /**
   * This method runs {@link d3-drag|https://github.com/d3/d3-drag}
   * against the current graph.
   * @returns {undefined}
   */
  _graphNodeDragConfig() {
    const customNodeDrag = d3Drag()
      .on("start", this._onDragStart)
      .on("drag", this._onDragMove)
      .on("end", this._onDragEnd);

    d3Select(`#${this.state.id}-${CONST.GRAPH_WRAPPER_ID}`).selectAll(".node").call(customNodeDrag);
  }

  /**
   * Sets d3 tick function and configures other d3 stuff such as forces and drag events.
   * Whenever called binds Graph component state with d3.
   * @returns {undefined}
   */
  _graphBindD3ToReactComponent() {
    if (!this.state.config.d3.disableLinkForce) {
      this.state.simulation.nodes(this.state.d3Nodes).on("tick", () => {
        // Propagate d3Nodes changes to nodes
        const newNodes = {};
        for (const node of this.state.d3Nodes) {
          newNodes[node.id] = node;
        }
        this._tick({ d3Nodes: this.state.d3Nodes, nodes: newNodes });
      });
      this._graphLinkForceConfig();
    }
    if (!this.state.config.freezeAllDragEvents) {
      this._graphNodeDragConfig();
    }
  }

  _nodeIdFromEvent = (e) => {
    var target = e.sourceEvent.target;
    while (target && !target.classList.contains("node")) {
      target = target.parentElement;
    }
    return (target && target.id) || null;
  };

  makeClick = (e) => {
    return new MouseEvent("click", {
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      bubbles: e.bubbles,
      button: e.button,
      buttons: e.buttons,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      bubbles: e.bubbles,
      cancelable: e.cancelable,
      composed: e.composed,
      view: e.view,
    });
  };

  /**
   * Handles d3 drag 'end' event.
   * @returns {undefined}
   */
  _onDragEnd = (e) => {
    if (this.nodeMouseDown && !this.isDraggingNode) {
      // Actually just a click
      const click = this.makeClick(e.sourceEvent);
      this.isDraggingNode = false;
      this.nodeMouseDown = null;

      this.allowNodeClick = true;
      e.sourceEvent.target.dispatchEvent(click);
      this.allowNodeClick = false;
      return;
    }

    this.isDraggingNode = false;
    this.nodeMouseDown = null;

    if (this.state.draggedNodes) {
      this.state.draggedNodes.forEach((node) => {
        this.onNodePositionChange(node);
      });
      this._tick({ draggedNodes: null });
    }

    !this.state.config.staticGraph &&
      this.state.config.automaticRearrangeAfterDropNode &&
      this.state.simulation.alphaTarget(this.state.config.d3.alphaTarget).restart();
  };

  /**
   * Handles d3 'drag' event.
   * {@link https://github.com/d3/d3-drag/blob/master/README.md#drag_subject|more about d3 drag}
   * @param  {Object} ev - if not undefined it will contain event data.
   * @param  {number} index - index of the node that is being dragged.
   * @param  {Array.<Object>} nodeList - array of d3 nodes. This list of nodes is provided by d3, each
   * node contains all information that was previously fed by rd3g.
   * @returns {undefined}
   */
  _onDragMove = (e) => {
    if (this.nodeMouseDown) {
      const delta = (e.x - this.nodeMouseDown.x) ** 2 + (e.y - this.nodeMouseDown.y) ** 2;
      if (!this.isDraggingNode && delta > 30) {
        const id = this._nodeIdFromEvent(e);
        let draggedNode = this.state.nodes[id];
        this.isDraggingNode = true;
        if (!this.selection.nodeIsSelected(id)) {
          const oldSelection = this.selection.freeze();
          if (!e.sourceEvent.shiftKey) {
            this.selection.clear();
          }
          this.selection.addNode(id);
          this.onSelectionChange(oldSelection, this.selection.freeze());
        }
      }
    }

    if (!this.state.config.staticGraph && this.isDraggingNode) {
      const ids = Array.from(this.selection.nodes);
      const draggedNodes = ids.flatMap((id) => {
        // this is where d3 and react bind
        let draggedNode = this.state.nodes[id];

        draggedNode.oldX = draggedNode.x;
        draggedNode.oldY = draggedNode.y;

        const newX = draggedNode.x + e.dx;
        const newY = draggedNode.y + e.dy;
        const shouldUpdateNode = !this.state.config.bounded || isPositionInBounds({ x: newX, y: newY }, this.state);

        if (shouldUpdateNode) {
          draggedNode.x = newX;
          draggedNode.y = newY;

          // set nodes fixing coords fx and fy
          draggedNode["fx"] = draggedNode.x;
          draggedNode["fy"] = draggedNode.y;

          return [draggedNode];
        } else {
          return [];
        }
      });

      this._tick({ draggedNodes });
    }
  };

  /**
   * Handles d3 drag 'start' event.
   * @returns {undefined}
   */
  _onDragStart = (e) => {
    this.nodeMouseDown = e.sourceEvent;
    this.isDraggingNode = false;
    this.pauseSimulation();

    if (this.state.enableFocusAnimation) {
      this.setState({ enableFocusAnimation: false });
    }
  };

  /**
   * Sets nodes and links highlighted value.
   * @param  {string} id - the id of the node to highlight.
   * @param  {boolean} [value=false] - the highlight value to be set (true or false).
   * @returns {undefined}
   */
  _setNodeHighlightedValue = (id, value = false) =>
    this._tick(updateNodeHighlightedValue(this.state.nodes, this.state.links, this.state.config, id, value));

  /**
   * The tick function simply calls React set state in order to update component and render nodes
   * along time as d3 calculates new node positioning.
   * @param {Object} state - new state to pass on.
   * @param {Function} [cb] - optional callback to fed in to {@link setState()|https://reactjs.org/docs/react-component.html#setstate}.
   * @returns {undefined}
   */
  _tick = (state = {}, cb) => (cb ? this.setState(state, cb) : this.setState(state));

  _zoomEq = (z1, z2) =>
    z1 && z2 &&
    z1.x !== null && z1.x !== undefined &&
    z1.y !== null && z1.y !== undefined &&
    z1.k !== null && z1.k !== undefined &&
    z1.x === z2.x && z1.y === z2.y && z1.k === z2.k;

  /**
   * Configures zoom upon graph with default or user provided values.<br/>
   * NOTE: in order for users to be able to double click on nodes, we
   * are disabling the native dblclick.zoom from d3 that performs a zoom
   * whenever a user double clicks on top of the graph.
   * {@link https://github.com/d3/d3-zoom#zoom}
   * @returns {undefined}
   */
  _zoomConfig = () => {
    const selector = d3Select(`#${this.state.id}-${CONST.GRAPH_WRAPPER_ID}`);

    this.zoomObject = d3Zoom().scaleExtent([this.state.config.minZoom, this.state.config.maxZoom]);

    if (!this.state.config.freezeAllDragEvents) {
      this.zoomObject
        .on("zoom", (e) => {
          this._zoomed(e);
          this.onGraphMouseMove(e);
        })
        .on("start", this.onGraphMouseDown)
        .on("end", this.onGraphMouseUp);
    }

    if (this.state.config.initialZoom !== null) {
      this.zoomObject.scaleTo(selector, this.state.config.initialZoom);
    } else if (this.state.transform && !this._zoomEq(this.state.transform, this.state.previousZoom)) {
      this.zoomObject.transform(selector, this.state.transform);
    }

    // avoid double click on graph to trigger zoom
    // for more details consult: https://github.com/danielcaldas/react-d3-graph/pull/202
    selector.call(this.zoomObject).on("dblclick.zoom", null);
  };

    _zoomed_setState = debounce(state => {
        this.setState(state);
    })

  /**
   * Handler for 'zoom' event within zoom config.
   * @returns {Object} returns the transformed elements within the svg graph area.
   */
  _zoomed = (e) => {
    if (!this.allowPanAndZoom) {
      return;
    }
    const transform = e.transform;

    d3SelectAll(`#${this.state.id}-${CONST.GRAPH_CONTAINER_ID}`).attr("transform", transform);
    const majk = this.state.config.grid.majorStep * transform.k;
    const t =
      "translate(" +
          ((transform.x % majk) - majk) +
      "," +
          ((transform.y % majk)  - majk) +
      ") scale(" +
          transform.k +
      ")";
    d3SelectAll(`#${this.state.id}-${CONST.GRAPH_GRID_ID}`).attr("transform", t);

    const newZoom = !this._zoomEq(this.state.previousZoom, transform);
    // only send zoom change events if the zoom has changed (_zoomed() also gets called when panning)
    if (this.debouncedOnZoomChange && newZoom && !this.state.config.panAndZoom) {
      this.debouncedOnZoomChange(this.state.previousZoom, transform);
      this._zoomed_setState({ transform, previousZoom: transform });
    } else if (newZoom) {
      this._zoomed_setState({ transform });
    } else if (this.state.previousZoom === undefined) {
      this.setState({ previousZoom: transform });
    }
  };

  isGraphMouseEvent = (e) => {
    const tagName = e.target && e.target.tagName;
    const name = e?.target?.attributes?.name?.value;
    const svgContainerName = `svg-container-${this.state.id}`;
    return tagName.toUpperCase() === "SVG" && name === svgContainerName;
  };

  updateSelectorRect = (rect, start, now) => {
    const bounds = document.getElementById(`svg-container-${this.state.id}`).getBoundingClientRect();
    var x, y, width, height;
    if (start[0] > now[0]) {
      x = now[0];
      width = start[0] - x;
    } else {
      x = start[0];
      width = now[0] - x;
    }
    if (start[1] > now[1]) {
      y = now[1];
      height = start[1] - y;
    } else {
      y = start[1];
      height = now[1] - y;
    }
    x = (x - this.state.transform.x - bounds.left) / this.state.transform.k;
    y = (y - this.state.transform.y - bounds.top) / this.state.transform.k;
    width = width / this.state.transform.k;
    height = height / this.state.transform.k;
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    return [x, y, x + width, y + height];
  };

  onGraphMouseUp = (e) => {
    if (!e.sourceEvent || e.sourceEvent.type !== "mouseup") {
      return;
    }
    const selection = d3Select(`#${this.state.id}-${CONST.GRAPH_WRAPPER_ID}`);
    if (this.graphMouseDown && !this.graphDragging) {
      // Just a click
      const click = this.makeClick(e.sourceEvent);

      this.allowGraphClick = true;
      e.sourceEvent.target.dispatchEvent(click);
      this.allowGraphClick = false;
    } else if (this.graphMouseDown && this.graphDragging) {
      // Finished drag!
      if (this.graphMouseDown.shiftKey) {
        // Was a "selection" drag
        const transform = d3ZoomIdentity
          .translate(this.state.transform.x, this.state.transform.y)
          .scale(this.state.transform.k);
        selection.call(this.zoomObject.transform, transform).call(this.zoomObject);
        document
          .getElementById(`${this.state.id}-${CONST.GRAPH_CONTAINER_ID}`)
          .removeChild(this.graphDragging.selectorBox);
      }
    }
    this.allowPanAndZoom = true;
    this.graphDragging = null;
    this.graphMouseDown = null;
  };

  onGraphMouseMove = (e) => {
    if (!e.sourceEvent || e.sourceEvent.type !== "mousemove") {
      return;
    }
    if (this.graphMouseDown && !this.graphDragging) {
      const delta = (e.sourceEvent.x - this.graphMouseDown.x) ** 2 + (e.sourceEvent.y - this.graphMouseDown.y) ** 2;
      if (delta > 30) {
        if (this.graphMouseDown.shiftKey) {
          this.allowPanAndZoom = false;
          const g = document.getElementById(`${this.state.id}-${CONST.GRAPH_CONTAINER_ID}`);
          const selectorBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          selectorBox.setAttribute("id", `${this.state.id}-SELECTIONBOX`);
          selectorBox.setAttribute("style", "fill:rgba(0, 0, 0, 0.1);");
          this.updateSelectorRect(selectorBox, d3Pointer(e), d3Pointer(e));
          g.prepend(selectorBox);
          this.graphDragging = { start: e, startSelection: this.selection.freeze(), selectorBox: selectorBox };
        } else {
          this.graphDragging = { start: e, startSelection: this.selection.freeze() };
        }
      }
    }
    if (this.graphDragging && this.graphMouseDown.shiftKey) {
      const bounds = this.updateSelectorRect(
        this.graphDragging.selectorBox,
        d3Pointer(this.graphDragging.start),
        d3Pointer(e)
      );
      const oldSelection = this.selection.freeze();
      this.selection.clear();
      this.selection.addNodes(this.graphDragging.startSelection.nodes);
      const selected = Object.values(this.state.nodes).flatMap((node) => {
        const inBounds = node.x >= bounds[0] && node.x <= bounds[2] && node.y >= bounds[1] && node.y <= bounds[3];
        return inBounds ? [node.id] : [];
      });
      this.selection.addNodes(selected);
      this.onSelectionChange(oldSelection, this.selection.freeze());
    }
  };

  onGraphMouseDown = (e) => {
    if (e.sourceEvent && e.sourceEvent.type === "mousedown" && this.isGraphMouseEvent(e.sourceEvent)) {
      this.graphMouseDown = e.sourceEvent;
      this.graphDragging = null;
      if (e.sourceEvent.shiftKey) {
        this.allowPanAndZoom = false;
      }
    }
  };

  /**
   * Calls the callback passed to the component.
   * @param  {Object} e - The event of onClick handler.
   * @returns {undefined}
   */
  onClickGraph = (e) => {
    if (!this.allowGraphClick) {
      return;
    }
    if (this.state.enableFocusAnimation) {
      this.setState({ enableFocusAnimation: false });
    }

    // Only trigger the graph onClickHandler, if not clicked a node or link.
    // toUpperCase() is added as a precaution, as the documentation says tagName should always
    // return in UPPERCASE, but chrome returns lowercase
    if (this.isGraphMouseEvent(e)) {
      this.props.onClickGraph && this.props.onClickGraph(e);

      if (!e.shiftKey) {
        const oldSelection = this.selection.freeze();
        this.selection.clear();
        this.onSelectionChange(oldSelection, this.selection.freeze());
      }
    }
  };

  /**
   * Collapses the nodes, then checks if the click is doubled and calls the callback passed to the component.
   * @param  {Object} event - Click event
   * @param  {string} clickedNodeId - The id of the node where the click was performed.
   * @returns {undefined}
   */
  onClickNode = (event, clickedNodeId) => {
    if (!this.allowNodeClick) {
      return;
    }
    const clickedNode = this.state.nodes[clickedNodeId];
    if (!this.nodeClickTimer) {
      // Note: onDoubleClickNode is not defined we don't need a long wait
      // to understand weather a second click will arrive soon or not
      // we can immediately trigger the click timer because we're 100%
      // that the double click even is never intended
      const ttl = this.props.onDoubleClickNode ? CONST.TTL_DOUBLE_CLICK_IN_MS : 0;
      this.nodeClickTimer = setTimeout(() => {
        if (this.state.config.collapsible) {
          const leafConnections = getTargetLeafConnections(clickedNodeId, this.state.links, this.state.config);
          const links = toggleLinksMatrixConnections(this.state.links, leafConnections, this.state.config);
          const d3Links = toggleLinksConnections(this.state.d3Links, links);
          const firstLeaf = leafConnections?.["0"];

          let isExpanding = false;

          if (firstLeaf) {
            const visibility = links[firstLeaf.source][firstLeaf.target];

            isExpanding = visibility === 1;
          }

          this._tick(
            {
              links,
              d3Links,
            },
            () => {
              const oldSelection = this.selection.freeze();
              if (!event.shiftKey) {
                this.selection.clear();
              }
              this.selection.toggleNode(clickedNodeId);
              this.onSelectionChange(oldSelection, this.selection.freeze());

              this.props.onClickNode && this.props.onClickNode(event, clickedNodeId, clickedNode);

              if (isExpanding) {
                this._graphNodeDragConfig();
              }
            }
          );
        } else {
          const oldSelection = this.selection.freeze();
          if (!event.shiftKey) {
            this.selection.clear();
          }
          this.selection.toggleNode(clickedNodeId);
          this.onSelectionChange(oldSelection, this.selection.freeze());

          this.props.onClickNode && this.props.onClickNode(event, clickedNodeId, clickedNode);
        }
        this.nodeClickTimer = null;
      }, ttl);
    } else {
      this.props.onDoubleClickNode && this.props.onDoubleClickNode(event, clickedNodeId, clickedNode);
      this.nodeClickTimer = clearTimeout(this.nodeClickTimer);
    }
  };

  /**
   * Handles right click event on a node.
   * @param  {Object} event - Right click event.
   * @param  {string} id - id of the node that participates in the event.
   * @returns {undefined}
   */
  onRightClickNode = (event, id) => {
    const clickedNode = this.state.nodes[id];
    this.props.onRightClickNode && this.props.onRightClickNode(event, id, clickedNode);
  };

  /**
   * Handles mouse over node event.
   * @param  {string} id - id of the node that participates in the event.
   * @returns {undefined}
   */
  onMouseOverNode = (event, id) => {
    if (this.isDraggingNode) {
      return;
    }

    const clickedNode = this.state.nodes[id];
    this.props.onMouseOverNode && this.props.onMouseOverNode(event, id, clickedNode);

    this.state.config.nodeHighlightBehavior && this._setNodeHighlightedValue(id, true);
  };

  /**
   * Handles mouse out node event.
   * @param  {string} id - id of the node that participates in the event.
   * @returns {undefined}
   */
  onMouseOutNode = (event, id) => {
    if (this.isDraggingNode) {
      return;
    }

    const clickedNode = this.state.nodes[id];
    this.props.onMouseOutNode && this.props.onMouseOutNode(event, id, clickedNode);

    this.state.config.nodeHighlightBehavior && this._setNodeHighlightedValue(id, false);
  };

  /**
   * Handles click link event.
   * @param  {Object} event - Click event
   * @param  {Object} link - The clicked link
   * @returns {undefined}
   */
  onClickLink = (event, link) => {
    const oldSelection = this.selection.freeze();
    if (!event.shiftKey) {
      this.selection.clear();
    }
    this.selection.toggleLink(link.id);
    this.onSelectionChange(oldSelection, this.selection.freeze());

    this.props.onClickLink && this.props.onClickLink(link.source, link.target);
  };

  /**
   * Handles mouse over link event.
   * @param  {string} source - id of the source node that participates in the event.
   * @param  {string} target - id of the target node that participates in the event.
   * @returns {undefined}
   */
  onMouseOverLink = (event, source, target) => {
    this.props.onMouseOverLink && this.props.onMouseOverLink(event, source, target);

    if (this.state.config.linkHighlightBehavior) {
      const highlightedLink = { source, target };

      this._tick({ highlightedLink });
    }
  };

  /**
   * Handles mouse out link event.
   * @param  {string} source - id of the source node that participates in the event.
   * @param  {string} target - id of the target node that participates in the event.
   * @returns {undefined}
   */
  onMouseOutLink = (event, source, target) => {
    this.props.onMouseOutLink && this.props.onMouseOutLink(source, target);

    if (this.state.config.linkHighlightBehavior) {
      const highlightedLink = undefined;

      this._tick({ highlightedLink });
    }
  };

  /**
   * Handles node position change.
   * @param {Object} node - an object holding information about the dragged node.
   * @returns {undefined}
   */
  onNodePositionChange = (node) => {
    if (!this.props.onNodePositionChange) {
      return;
    }

    const { id, x, y } = node;

    this.props.onNodePositionChange(id, x, y);
  };

  onSelectionChange = (oldSelection, newSelection) => {
    if (!this.props.onSelectionChange) {
      return;
    }

    if (!Selection.equal(oldSelection, newSelection)) {
      this.props.onSelectionChange(oldSelection, newSelection);
    }
  };

  onKeyUp = (ev) => {
    if (!this.props.keybindings || !this.state.activeKeybindings) {
      return;
    }
    function keyname(e) {
      const ctrl = e.ctrlKey ? "Ctrl+" : "";
      const alt = e.altKey ? "Alt+" : "";
      const shift = e.shiftKey ? "Shift+" : "";
      const letter = e.key;
      return ctrl + alt + shift + letter;
    }
    const x = (this.mousePosition[0] - this.state.transform.x) / this.state.transform.k;
    const y = (this.mousePosition[1] - this.state.transform.y) / this.state.transform.k;
    (
      this.props.keybindings[keyname(ev)] ||
      function (_) {
        return;
      }
    )(ev, x, y);
  };

  enableKeybindings = () => {
    document.querySelector(`#svg-container-${this.state.id}`).focus();
    this.setState({ activeKeybindings: true });
  };

  disableKeybindings = () => {
    document.querySelector(`#svg-container-${this.state.id}`).blur();
    this.setState({ activeKeybindings: false });
  };

  updateMousePosition = (event) => {
    this.mousePosition = d3Pointer(event);
  };

  _mouseConfig() {
    d3Select(`#svg-container-${this.state.id}`)
      .on("mousemove", this.updateMousePosition)
      .on("mouseenter", this.enableKeybindings)
      .on("mouseleave", this.disableKeybindings);
  }

  /**
   * Calls d3 simulation.stop().<br/>
   * {@link https://github.com/d3/d3-force#simulation_stop}
   * @returns {undefined}
   */
  pauseSimulation = () => this.state.simulation.stop();

  /**
   * This method resets all nodes fixed positions by deleting the properties fx (fixed x)
   * and fy (fixed y). Following this, a simulation is triggered in order to force nodes to go back
   * to their original positions (or at least new positions according to the d3 force parameters).
   * @returns {undefined}
   */
  resetNodesPositions = () => {
    if (!this.state.config.staticGraph) {
      let initialNodesState = initializeNodes(this.props.data.nodes);
      for (let nodeId in this.state.nodes) {
        let node = this.state.nodes[nodeId];

        if (node.fx && node.fy) {
          Reflect.deleteProperty(node, "fx");
          Reflect.deleteProperty(node, "fy");
        }

        if (nodeId in initialNodesState) {
          let initialNode = initialNodesState[nodeId];
          node.x = initialNode.x;
          node.y = initialNode.y;
        }
      }

      this.state.simulation.alphaTarget(this.state.config.d3.alphaTarget).restart();

      this._tick();
    }
  };

  /**
   * Calls d3 simulation.restart().<br/>
   * {@link https://github.com/d3/d3-force#simulation_restart}
   * @returns {undefined}
   */
  restartSimulation = () => !this.state.config.staticGraph && this.state.simulation.restart();

  constructor(props) {
    super(props);

    if (!this.props.id) {
      throwErr(this.constructor.name, ERRORS.GRAPH_NO_ID_PROP);
    }

    this.grid = React.createRef();
    this.container = React.createRef();
    this.focusAnimationTimeout = null;
    this.nodeClickTimer = null;
    this.nodeMouseDown = null;
    this.isDraggingNode = false;
    this.allowNodeClick = false;
    this.graphMouseDown = null;
    this.graphDragging = null;
    this.allowGraphClick = false;
    this.zoomObject = null;
    this.allowPanAndZoom = true;
    this.mousePosition = [0, 0];
    this.selection = new Selection();
    if (this.props.selection) {
      this.selection.update(this.props.selection);
    }
    this.state = { activeKeybindings: false };
    this.state = initializeGraphState(this.props, this.state);
    this.debouncedOnZoomChange = this.props.onZoomChange ? debounce(this.props.onZoomChange, 100) : null;
  }

  /**
   * @deprecated
   * `componentWillReceiveProps` has a replacement method in react v16.3 onwards.
   * that is getDerivedStateFromProps.
   * But one needs to be aware that if an anti pattern of `componentWillReceiveProps` is
   * in place for this implementation the migration might not be that easy.
   * See {@link https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html}.
   * @param {Object} nextProps - props.
   * @returns {undefined}
   */
  // eslint-disable-next-line
  UNSAFE_componentWillReceiveProps(nextProps) {
    const { graphElementsUpdated, newGraphElements } = checkForGraphElementsChanges(nextProps, this.state);
    const state = graphElementsUpdated ? initializeGraphState(nextProps, this.state) : this.state;
    const newConfig = nextProps.config || {};
    const { configUpdated, d3ConfigUpdated } = checkForGraphConfigChanges(nextProps, this.state);
    const config = configUpdated ? merge(DEFAULT_CONFIG, newConfig) : this.state.config;

    // in order to properly update graph data we need to pause eventual d3 ongoing animations
    newGraphElements && this.pauseSimulation();

    // const transform =
    //   newConfig.panAndZoom !== this.state.config.panAndZoom ? { x: 0, y: 0, k: 1 } : this.state.transform;
    const moveTo = this._zoomEq(nextProps.viewTransform, this.state.transform) ? undefined : nextProps.viewTransform;
    const zoomUpdated = moveTo !== undefined || configUpdated || d3ConfigUpdated;
    const transform = moveTo || this.state.transform;
    const focusedNodeId = nextProps.data.focusedNodeId;
    const d3FocusedNode = this.state.d3Nodes.find((node) => `${node.id}` === `${focusedNodeId}`);
    const containerElId = `${this.state.id}-${CONST.GRAPH_WRAPPER_ID}`;
    const focusTransformation =
      getCenterAndZoomTransformation(d3FocusedNode, this.state.config, containerElId) || this.state.focusTransformation || moveTo;
    const enableFocusAnimation = this.props.data.focusedNodeId !== nextProps.data.focusedNodeId || moveTo;

    // if we're given a function to call when the zoom changes, we create a debounced version of it
    // this is because this function gets called in very rapid succession when zooming
    if (nextProps.onZoomChange) {
      this.debouncedOnZoomChange = debounce(nextProps.onZoomChange, 100);
    }

    if (nextProps.selection) {
      this.selection.update(nextProps.selection);
    }

    this.setState({
      ...state,
      config,
      configUpdated,
      d3ConfigUpdated,
      newGraphElements,
      transform,
      zoomUpdated,
      focusedNodeId,
      enableFocusAnimation,
      focusTransformation,
    });
  }

  componentDidUpdate() {
    // if the property staticGraph was activated we want to stop possible ongoing simulation
    const shouldPause = this.state.config.staticGraph || this.state.config.staticGraphWithDragAndDrop;

    if (shouldPause) {
      this.pauseSimulation();
    }

    if (!this.state.config.staticGraph && (this.state.newGraphElements || this.state.d3ConfigUpdated)) {
      this._graphBindD3ToReactComponent();

      if (!this.state.config.staticGraphWithDragAndDrop) {
        this.restartSimulation();
      }

      this.setState({ newGraphElements: false, d3ConfigUpdated: false });
    } else if (this.state.configUpdated) {
      this._graphNodeDragConfig();
    }

    if (this.state.configUpdated) {
      if (this.props.showGrid) {
        this._drawGrid(this.state.config.grid);
      } else {
        this._destroyGrid();
      }
      this.setState({ configUpdated: false });
    }
    if (this.state.zoomUpdated) {
      this._zoomConfig();
      this.setState({ zoomUpdated: false });
    }
  }

  componentDidMount() {
    if (!this.state.config.staticGraph) {
      this._graphBindD3ToReactComponent();
    }

    if (this.props.showGrid) {
      this._drawGrid(this.state.config.grid);
    }

    // graph zoom and drag&drop all network
    this._zoomConfig();
    this._mouseConfig();
  }

  componentWillUnmount() {
    this.pauseSimulation();

    if (this.nodeClickTimer) {
      clearTimeout(this.nodeClickTimer);
      this.nodeClickTimer = null;
    }

    if (this.focusAnimationTimeout) {
      clearTimeout(this.focusAnimationTimeout);
      this.focusAnimationTimeout = null;
    }
  }

  _drawGrid(gridCfg) {
    const container = this.container.current;
    const grid = d3Select("#" + this.grid.current.id).selectAll("line");

    const height = container.offsetHeight / this.state.config.minZoom;
    const width = container.offsetWidth / this.state.config.minZoom;
    const overflow = gridCfg.majorStep / this.state.config.minZoom;

      const make = (fill, span, step, major, minor, color, width) => {
      const count = Math.ceil((fill + 2 * overflow) / step);
      const arr = d3Range(0, count + 1);
      const gridView = grid.data(arr).enter();
      gridView
        .append("line")
        .attr(major + "1", (d) => d * step)
        .attr(major + "2", (d) => d * step)
        .attr(minor + "1", -overflow)
        .attr(minor + "2", span + overflow)
        .style("stroke", color)
        .style("stroke-width", width);
    };

    make(width, height, gridCfg.minorStep, "x", "y", gridCfg.minorColor, gridCfg.minorWidth);
    make(height, width, gridCfg.minorStep, "y", "x", gridCfg.minorColor, gridCfg.minorWidth);
    make(width, height, gridCfg.majorStep, "x", "y", gridCfg.majorColor, gridCfg.majorWidth);
    make(height, width, gridCfg.majorStep, "y", "x", gridCfg.majorColor, gridCfg.majorWidth);
  }

  _destroyGrid() {
    d3Select("#" + this.grid.current.id)
      .selectAll("line")
      .remove();
  }

  render() {
    const { nodes, links, defs } = renderGraph(
      this.state.nodes,
      {
        onClickNode: this.onClickNode,
        onDoubleClickNode: this.onDoubleClickNode,
        onRightClickNode: this.onRightClickNode,
        onMouseOverNode: this.onMouseOverNode,
        onMouseOut: this.onMouseOutNode,
      },
      this.state.d3Links,
      this.state.links,
      {
        onClickLink: this.onClickLink,
        onRightClickLink: this.props.onRightClickLink,
        onMouseOverLink: this.onMouseOverLink,
        onMouseOutLink: this.onMouseOutLink,
      },
      this.state.config,
      this.state.highlightedNode,
      this.state.highlightedLink,
      this.state.transform.k,
      this.selection
    );

    const svgStyle = {
      outline: "none",
      height: this.state.config.height,
      width: this.state.config.width,
    };

    const containerProps = this._generateFocusAnimationProps();

    return (
      <div id={`${this.state.id}-${CONST.GRAPH_WRAPPER_ID}`} style={this.props.style} ref={this.container}>
        <svg
          name={`svg-container-${this.state.id}`}
          id={`svg-container-${this.state.id}`}
          style={svgStyle}
          tabIndex={"0"}
          onClick={this.onClickGraph}
          onKeyUp={this.onKeyUp}
        >
          {defs}
          <g id={`${this.state.id}-${CONST.GRAPH_GRID_ID}`} ref={this.grid} />
          <g id={`${this.state.id}-${CONST.GRAPH_CONTAINER_ID}`} {...containerProps}>
            {nodes}
            {links}
          </g>
        </svg>
      </div>
    );
  }
}
