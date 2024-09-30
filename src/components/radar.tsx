import React from "react";

interface RadarProps {
    intelligence: number;
    memory: number;
    perception: number;
    willpower: number;
    charisma: number;
}

const pentagram_points = Object.freeze([
    [0.5, 0],
    [1, 0.3819660112501065],
    [0.8090169943749439, 1],
    [0.19098300562505244, 1],
    [0, 0.3819660112501065],
]);

function attribute_ratio(attribute: number): number {
    return (attribute - 16) / 16; // previously -17, /15, but made radars flat
}

const outline_style = {
    fill: "none",
    stroke: "#777",
    strokeWidth: "2.5px",
};

const attribute_style = {
    stroke: "#1aa3e9",
    strokeWidth: "2px",
    fill: "rgba(28, 164, 233, 0.5)",
};

const pent_size = 200;
const pent_x = 60;
const pent_y = 60;

function get_point_values(ratios: number[]) {
    return pentagram_points.map(([x, y], i) => [
        pent_x + pent_size * ((x - 0.5) * ratios[i] + 0.5),
        pent_y + pent_size * ((y - 0.5) * ratios[i] + 0.5),
    ]);
}

function get_points_string(values) {
    return values.map(([x, y]) => `${x},${y}`).join(" ");
}

const max_points = get_point_values([1, 1, 1, 1, 1]);
const label_points = get_point_values([1.05, 1.2, 1.2, 1.2, 1.2]);
const text_style: React.CSSProperties = {
    fill: "#fff",
    textAnchor: "middle",
    fontSize: "26px",
};
const line_style = {
    stroke: "#444",
    strokeDasharray: "4",
    strokeWidth: "8px",
};
const labels = ["INT", "MEM", "PER", "WIL", "CHA"];
const outline = (
    <g>
        <polygon style={outline_style} points={get_points_string(max_points)} />
        {max_points.map(([x, y], i) => (
            <line
                key={i}
                x1={pent_x + pent_size / 2}
                y1={pent_y + pent_size / 2}
                x2={x}
                y2={y}
                style={line_style}
            />
        ))}
        {[0, 1, 2, 3, 4].map((idx) => (
            <text key={idx} style={text_style} x={label_points[idx][0]} y={label_points[idx][1]}>
                {labels[idx]}
            </text>
        ))}
    </g>
);

export class RadarOutline extends React.PureComponent<
    React.PropsWithChildren<Record<never, never>>
> {
    render() {
        return (
            <svg
                className="neural_map_radar"
                width="160px"
                height="160px"
                viewBox="0 0 320 320"
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
            >
                {outline}
                {this.props.children}
            </svg>
        );
    }
}

export class Radar extends React.PureComponent<RadarProps> {
    render() {
        const props = this.props;
        const attr_points = get_point_values(
            [
                props.intelligence,
                props.memory,
                props.perception,
                props.willpower,
                props.charisma,
            ].map(attribute_ratio),
        );
        return (
            <RadarOutline>
                <polygon style={attribute_style} points={get_points_string(attr_points)} />
            </RadarOutline>
        );
    }
}
