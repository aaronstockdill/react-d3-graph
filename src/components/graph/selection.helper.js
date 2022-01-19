/**
 * @module Graph/selection-helper
 * @description
 * Useful functions for managing the selection state of the nodes and links in the graph.
 */
import { getId } from "./graph.helper";
import { logError } from "../../utils";

class Selection {
  linkIsSelected = (linkId) => {
    return this.links.has(linkId);
  };

  nodeIsSelected = (nodeId) => {
    return this.nodes.has(linkId);
  };

  addLinks = (linkIds) => {
    linkIds.forEach((id) => this.links.add(id));
  };

  addLink = (linkId) => {
    this.addLinksToSelection([linkId]);
  };

  addNodes = (nodeIds) => {
    nodeIds.forEach((id) => this.nodes.add(id));
  };

  addNode = (nodeId) => {
    this.addNodesToSelection([nodeId]);
  };

  removeLink = (linkId) => {
    this.links.delete(linkId);
  };

  removeNode = (nodeId) => {
    this.nodes.delete(nodeId);
  };

  clear = () => {
    this.nodes.clear();
    this.links.clear();
  };

  freeze = () => {
    return { nodes: Array(this.nodes), links: Array(this.links) };
  };

  constructor() {
    this.nodes = Set();
    this.links = Set();
  }
}

export { Selection };
