import React from "react";

/**
 * Link component is responsible for encapsulating link render.
 * @example
 * const onClickLink = function(source, target) {
 *      window.alert(`Clicked link between ${source} and ${target}`);
 * };
 *
 * const onRightClickLink = function(source, target) {
 *      window.alert(`Right clicked link between ${source} and ${target}`);
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
 * <Link
 *     d="M1..."
 *     source="idSourceNode"
 *     target="idTargetNode"
 *     markerId="marker-small"
 *     strokeWidth=1.5
 *     stroke="green"
 *     strokeDasharray="5 1"
 *     strokeDashoffset="3"
 *     strokeLinecap="round"
 *     className="link"
 *     opacity=1
 *     mouseCursor="pointer"
 *     onClickLink={onClickLink}
 *     onRightClickLink={onRightClickLink}
 *     onMouseOverLink={onMouseOverLink}
 *     onMouseOutLink={onMouseOutLink} />
 */
export default class Link extends React.Component {
  /**
   * Handle link click event.
   * @param {Object} event - native event.
   * @returns {undefined}
   */
  handleOnClickLink = (event) => this.props.onClickLink && this.props.onClickLink(event, this.props);

  /**
   * Handle link right click event.
   * @param {Object} event - native event.
   * @returns {undefined}
   */
  handleOnRightClickLink = (event) =>
    this.props.onRightClickLink && this.props.onRightClickLink(event, this.props.source, this.props.target);

  /**
   * Handle mouse over link event.
   * @returns {undefined}
   */
  handleOnMouseOverLink = (event) =>
    this.props.onMouseOverLink && this.props.onMouseOverLink(event, this.props.source, this.props.target);

  /**
   * Handle mouse out link event.
   * @returns {undefined}
   */
  handleOnMouseOutLink = (event) =>
    this.props.onMouseOutLink && this.props.onMouseOutLink(event, this.props.source, this.props.target);

  constructor(props) {
    super(props);
    this.lineRef = React.createRef();
    this.labelRef = React.createRef();
  }

  setLabelPosition() {
    if (this.lineRef.current === null || this.labelRef.current === null) {
      return;
    }
    let length = this.lineRef.current.getTotalLength();
    let point = this.lineRef.current.getPointAtLength(length * 0.5);
    let bbox = this.labelRef.current.getBBox();
    this.labelRef.current.setAttributeNS(null, "x", point.x - bbox.width/2);
    this.labelRef.current.setAttributeNS(null, "y", point.y - bbox.height/2);
  }

  componentDidMount() {
    this.setLabelPosition();
  }

  componentDidUpdate(prevProps) {
    this.setLabelPosition();
  }

  render() {
    const lineStyle = {
      strokeWidth: this.props.strokeWidth,
      stroke: this.props.stroke,
      opacity: this.props.opacity,
      fill: "none",
      cursor: this.props.mouseCursor,
      strokeDasharray: this.props.strokeDasharray,
      strokeDashoffset: this.props.strokeDasharray,
      strokeLinecap: this.props.strokeLinecap,
    };

    const lineProps = {
      className: this.props.className,
      d: this.props.d,
      onClick: this.handleOnClickLink,
      onContextMenu: this.handleOnRightClickLink,
      onMouseOut: this.handleOnMouseOutLink,
      onMouseOver: this.handleOnMouseOverLink,
      style: lineStyle,
    };

    const lineHitProps = {
      ...lineProps,
      className: this.props.className + "-hit",
      style: {
        stroke: "transparent",
        strokeWidth: "10px",
        fill: "none",
        cursor: this.props.mouseCursor,
      }
    };

    if (this.props.markerId) {
      lineProps.markerEnd = `url(#${this.props.markerId})`;
    } else if (this.props.markerEnd) {
      lineProps.markerEnd = `url(#${this.props.markerEnd})`;
    }
    if (this.props.markerStart) {
      lineProps.markerStart = `url(#${this.props.markerStart})`;
    }

    const { label, id } = this.props;

    let labelNode = null;
    if (label === null) {
      labelNode = React.null;
    } else if (typeof label === "string") {
      const textProps = {
        dy: -1,
        style: {
          fill: this.props.fontColor,
          fontSize: this.props.fontSize,
          fontWeight: this.props.fontWeight,
        },
      };
      labelNode =
        <text id={id + "_label"} style={{textAnchor: "middle"}} {...textProps} ref={this.labelRef} onClick={this.handleOnClickLink} >
          {label}
        </text>
    } else {
      labelNode = <svg ref={this.labelRef} id={id + "_label"} onClick={this.handleOnClickLink}>{label}</svg>
    }

    return (
      <g>
        <path {...lineHitProps} id={id + "_hit"} />
          <path {...lineProps} id={id} ref={this.lineRef} />
          {labelNode}
      </g>
    );
  }
}
