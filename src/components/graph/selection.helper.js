/**
 * @module Graph/selection-helper
 * @description
 * Useful functions for managing the selection state of the nodes and links in the graph.
 */
import { getId } from "./graph.helper";
import { logError } from "../../utils";

class Selection {
  nodes;
  links;

  constructor() {
    this.nodes = new Set();
    this.links = new Set();
  }

  update = (other) => {
    this.nodes = new Set(other.nodes);
    this.links = new Set(other.links);
  };

  linkIsSelected = (linkId) => {
    return this.links.has(linkId);
  };

  nodeIsSelected = (nodeId) => {
    return this.nodes.has(nodeId);
  };

  addLinks = (linkIds) => {
    linkIds.forEach((id) => this.links.add(id));
  };

  addLink = (linkId) => {
    this.addLinks([linkId]);
  };

  addNodes = (nodeIds) => {
    nodeIds.forEach((id) => this.nodes.add(id));
  };

  addNode = (nodeId) => {
    this.addNodes([nodeId]);
  };

  removeLink = (linkId) => {
    this.links.delete(linkId);
  };

  removeNode = (nodeId) => {
    this.nodes.delete(nodeId);
  };

  toggleLink = (linkId) => {
    this.linkIsSelected(linkId) ? this.removeLink(linkId) : this.addLink(linkId);
  };

  toggleNode = (nodeId) => {
    this.nodeIsSelected(nodeId) ? this.removeNode(nodeId) : this.addNode(nodeId);
  };

  clear = () => {
    this.nodes.clear();
    this.links.clear();
  };

  freeze = () => {
    return { nodes: Array.from(this.nodes), links: Array.from(this.links) };
  };

  static equal = (a, b) => {
    const eq = (x, y) => {
      if (x.length !== y.length) {
        return false;
      }
      for (let i=0; i<x.length; i++) {
        if (x[i] !== y[i]) {
          return false;
        }
      }
      return true;
    }
    return eq(a.nodes, b.nodes) && eq(a.links, b.links);
  }
}

export { Selection };
