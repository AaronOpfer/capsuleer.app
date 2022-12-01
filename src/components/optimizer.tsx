import React from "react";
import {skill_data} from "../static_skill_data";
import {format_duration} from "../misc/formatting";
import {CharacterSkills, CharacterSkillQueueItem} from "../character_skills";
import {format_with_decimals} from "../misc/formatting";
import {ComparisonRadar, Radar, RadarOutline} from "./radar";
import {optimize, OptimizationResults, SPAllocation, AttributeMapping} from "../optimizer";

function array_to_radar_props(attrs: number[]) {
    return {
        intelligence: attrs[0],
        memory: attrs[1],
        perception: attrs[2],
        willpower: attrs[3],
        charisma: attrs[4],
    };
}

class ImplantDurationTable extends React.PureComponent<{durations: number[]}> {
    render() {
        const durations = this.props.durations;
        const items = durations.map((duration, level) => (
            <tr key={level}>
                <th>+{level}</th>
                <td>{format_duration(duration, false)}</td>
                <td>
                    {level === 0 ? "-" : format_duration(durations[level - 1] - duration, false)}
                </td>
                <td>{level === 0 ? "-" : format_duration(durations[0] - duration, false)}</td>
            </tr>
        ));
        return (
            <table className="implant_duration_table">
                <thead>
                    <tr>
                        <th>Implant Bonus</th>
                        <th>Time Taken</th>
                        <th>Improvement</th>
                        <th>Total Savings</th>
                    </tr>
                </thead>
                <tbody>{items}</tbody>
            </table>
        );
    }
}

interface OptimizerMappingPanelProps {
    current_mapping: AttributeMapping | undefined;
    best_mapping: AttributeMapping | undefined;
}

interface OptimizerMappingPanelState {
    viewing_old: boolean;
}

class OptimizerMappingPanel extends React.PureComponent<
    OptimizerMappingPanelProps,
    OptimizerMappingPanelState
> {
    constructor(props) {
        super(props);
        this.state = {viewing_old: false};
    }
    render() {
        const props = this.props;
        let radar: JSX.Element;
        let label: null | string;
        let durations;
        if (props.current_mapping === undefined) {
            radar = <RadarOutline />;
            label = null;
            durations = [0, 0, 0, 0, 0, 0];
        } else if (props.best_mapping === undefined) {
            label = "Optimized (Current) Mapping";
            radar = <Radar {...array_to_radar_props(props.current_mapping.attributes)} />;
            durations = props.current_mapping.duration_implants;
        } else {
            let mappings = {
                old: array_to_radar_props(props.current_mapping.attributes),
                new: array_to_radar_props(props.best_mapping.attributes),
            };
            label = "Optimized Mapping";
            if (this.state.viewing_old) {
                label = "Previous Mapping";
                mappings = {new: mappings.old, old: mappings.new};
                durations = props.current_mapping.duration_implants;
            } else {
                durations = props.best_mapping.duration_implants;
            }
            radar = <ComparisonRadar {...mappings} />;
        }
        return (
            <div>
                <h3>{label}</h3>
                {radar}
                <ImplantDurationTable durations={durations} />
            </div>
        );
    }
}

const roman_numeral_levels = ["", "I", "II", "III", "IV", "V"];

class SPAllocationsTable extends React.PureComponent<{allocations: SPAllocation[] | undefined}> {
    render() {
        const allocations = this.props.allocations;
        if (allocations === undefined || allocations.length === 0) {
            return null;
        }
        return (
            <table className="sp_allocations_table">
                <thead>
                    <tr>
                        <th>Skill</th>
                        <th>SP Allocated</th>
                    </tr>
                </thead>
                <tbody>
                    {allocations.map((allocation, idx) => {
                        const {id, level, sp} = allocation;
                        const {name, category_id} = skill_data.skill(id);
                        return (
                            <tr key={idx}>
                                <td data-cid={category_id}>
                                    {name}{" "}
                                    <span className="skill_queue_level">
                                        {roman_numeral_levels[level]}
                                    </span>
                                </td>
                                <td>{format_with_decimals(sp, 0)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    }
}

interface OptimizerProps {
    data: CharacterSkills | null;
}

interface OptimizerState {
    results: OptimizationResults | null;
}

export default class Optimizer extends React.PureComponent<OptimizerProps, OptimizerState> {
    constructor(props) {
        super(props);
        this.state = {results: props.data === null ? null : optimize(props.data)};
    }

    static getDerivedStateFromProps(props, state) {
        if (props.data === null) {
            return {results: null};
        }
        return null;
    }

    componentDidUpdate(prevProps) {
        if (this.props.data === null) {
            if (this.state.results !== null) {
                this.setState({results: null});
            }
        } else {
            if (this.props.data.skill_queue.length === 0) {
                this.setState({results: null});
            } else if (this.state.results === null) {
                this.setState({results: optimize(this.props.data)});
            } else if (
                prevProps.data === null ||
                prevProps.data.character_id !== this.props.data.character_id
            ) {
                this.setState({results: optimize(this.props.data)});
            }
        }
    }

    render() {
        const character_data = this.props.data;
        if (character_data !== null && character_data.skill_queue.length === 0) {
            return (
                <span className="wallet_notice">
                    To use the optimizer, create a skill queue in-game and refresh this page.
                </span>
            );
        }
        const data = this.state.results;

        let header: JSX.Element | null = null;
        if (
            data !== null &&
            data.current.attributes.toString() != data.best.attributes.toString()
        ) {
            header = (
                <div className="optimizer_savings">
                    Saves at least{" "}
                    {format_duration(
                        data.current.duration_implants[5] - data.best.duration_implants[5],
                        false
                    )}
                </div>
            );
        } else if (data !== null) {
            header = <div>Your mapping is optimized.</div>;
        }

        return (
            <div className="optimizer">
                <div className="optimizer_radars">
                    <div>
                        {header}
                        <OptimizerMappingPanel
                            current_mapping={data?.current}
                            best_mapping={data?.best}
                        />
                    </div>
                    <SPAllocationsTable allocations={data?.best_mapping_sp_allocations} />
                </div>
                <div className="optimizer_warning">
                    <h3>Warning</h3>
                    <p>
                        The optimizer is a tool meant to inform your early planning process. Neural
                        Remaps are a limited resource. Plan carefully before spending them.
                    </p>
                    <p>
                        The optimizer acts based on your current skill queue. If you have skills you
                        want to train that aren't yet listed, go in-game and add them to your queue
                        so that the optimizer is better informed.
                    </p>
                    <p>
                        The optimizer is in early stages. It does not yet know how to spend more
                        than one remap in one skill queue. Your optimal skill plan therefore may be
                        different than what is displayed here.
                    </p>
                </div>
            </div>
        );
    }
}
