import React from "react";
import CharacterSkills from "../character_skills";
import {format_with_decimals} from "../misc/formatting";
import {Radar, RadarOutline} from "./radar";

interface CharSummaryProps {
    name: string;
    data: CharacterSkills | null;
}

export default class CharSummary extends React.Component<CharSummaryProps, Record<string, never>> {
    render() {
        const data = this.props.data;

        let queue_paused: JSX.Element | null = null;
        let accelerator: JSX.Element | null = null;
        let unallocated_sp: JSX.Element | null = null;
        let extractor_text = "";
        let radar = <RadarOutline />;
        if (data != null) {
            queue_paused = data.skill_queue_paused ? (
                <div className="char_summary_queue_paused">Skill Queue Paused</div>
            ) : data.skill_queue.length == 0 ? (
                <div className="char_summary_queue_empty">Skill Queue Empty</div>
            ) : null;

            accelerator = data.accelerator_amount ? (
                <span
                    className="char_summary_accelerator"
                    title={`Under effects of a +${data.accelerator_amount} Cerebral Accelerator`}
                >
                    +{data.accelerator_amount}
                    <img
                        src="https://images.evetech.net/types/48582/icon?size=32"
                        width="16"
                        height="16"
                    />
                </span>
            ) : null;

            unallocated_sp = data.unallocated_sp ? (
                <tr className="character_stats_unallocated_sp" title="Unallocated SP">
                    <td className="unallocated_sp">{data.unallocated_sp.toLocaleString()}</td>
                    <td> SP</td>
                </tr>
            ) : null;

            const extractors = Math.max(0, (data.total_sp - 5000000) / 500000);
            extractor_text = `${format_with_decimals(extractors, 1)} extractors`;

            radar = (
                <Radar
                    intelligence={data.intelligence}
                    memory={data.memory}
                    perception={data.perception}
                    willpower={data.willpower}
                    charisma={data.charisma}
                />
            );
        }

        return (
            <div className="char_summary">
                <div>
                    <div className="char_title">
                        <h2>{this.props.name}</h2>
                        {accelerator}
                    </div>
                    {queue_paused}
                    <table className="character_stats">
                        <tbody>
                            <tr>
                                <td>
                                    {data ? Math.floor(data.wallet_balance).toLocaleString() : "-"}
                                </td>
                                <td>ISK</td>
                            </tr>
                            <tr title={extractor_text}>
                                <td>{data ? Math.floor(data.total_sp).toLocaleString() : "-"}</td>
                                <td>SP</td>
                            </tr>
                            {unallocated_sp}
                        </tbody>
                    </table>
                    <style>{data ? data.create_styles() : ""}</style>
                </div>
                <div>{radar}</div>
            </div>
        );
    }
}
