import React from "react";
import {format_with_decimals, get_formatter} from "../misc/formatting";

interface ISKForSPPanelItemProps {
    name: string;
    formatter: any;
    image_type_id: number;
    price: number;
    isk_sp: number | null;
    sp: number | null;
    sp_day: number | null;
}

class ISKForSPPanelItem extends React.PureComponent<ISKForSPPanelItemProps, {}> {
    render() {
        const s = this.props;
        return (
            <tr>
                <td>
                    {s.name}
                    <img src={`https://images.evetech.net/types/${s.image_type_id}/icon?size=32`} />
                </td>
                <td>{s.formatter(s.price)}</td>
                <td>{s.sp !== null ? format_with_decimals(s.sp, 0) : "---"}</td>
                <td>
                    {s.sp_day !== null
                        ? s.sp_day === Infinity
                            ? "∞"
                            : format_with_decimals(s.sp_day, 0)
                        : "---"}
                </td>
                <td>{s.isk_sp !== null ? format_with_decimals(s.isk_sp, 0) : "---"}</td>
            </tr>
        );
    }
}
interface ISKForSPPanelProps {
    biology_skill_level: number | null;
    biology_implant_multiplier: number | null;
    millions_of_sp: number | null;
}

interface ISKForSPPanelAccelerator {
    type_id: number;
    price: number;
    name: string;
    magnitude: number;
    duration: number;
}

interface ISKForSPPanelState {
    fake_biology_5: boolean;
    fake_implant: boolean;
    lsi_price: number | null;
    ssi_price: number | null;
    accelerators: ISKForSPPanelAccelerator[];
}

interface ISKForSPItemData {
    type_id: number;
    image_type_id: number;
    name: string;
    price: number;
    sp: number | null;
    isk_sp: number | null;
    sp_day: number | null;
}

// This is kind of lying; it's not a pure component if it downloads data with fetch()
export default class ISKForSPPanel extends React.PureComponent<
    ISKForSPPanelProps,
    ISKForSPPanelState
> {
    constructor(props) {
        super(props);
        this.state = {
            lsi_price: null,
            ssi_price: null,
            fake_biology_5: false,
            fake_implant: false,
            accelerators: [],
        };
    }

    async componentDidMount() {
        const data = await (
            await fetch("/skilltrades", {
                credentials: "same-origin",
                redirect: "manual",
            })
        ).json();

        this.setState({
            lsi_price: data[0],
            ssi_price: data[1],
            accelerators: data[2].map((d) => ({
                type_id: d[0],
                price: d[1],
                name: d[2],
                magnitude: d[3],
                duration: d[4],
            })),
        });
    }

    get_injector_isk_sp(): ISKForSPItemData[] {
        const props = this.props;
        const state = this.state;
        if (state.lsi_price == null || state.ssi_price == null) {
            return [];
        }
        const result: ISKForSPItemData[] = [
            {
                type_id: 40520,
                image_type_id: 40520,
                name: "Large Skill Injector",
                price: state.lsi_price,
                sp: null,
                isk_sp: null,
                sp_day: Infinity,
            },
            {
                type_id: 45635,
                image_type_id: 45635,
                name: "Small Skill Injector",
                price: state.ssi_price,
                sp: null,
                isk_sp: null,
                sp_day: Infinity,
            },
        ];

        if (props.millions_of_sp != null) {
            let si_effectiveness = 0.3;
            if (props.millions_of_sp < 5) {
                si_effectiveness = 1;
            } else if (props.millions_of_sp < 50) {
                si_effectiveness = 0.8;
            } else if (props.millions_of_sp < 80) {
                si_effectiveness = 0.6;
            }
            result[0].sp = 500000 * si_effectiveness;
            result[1].sp = 100000 * si_effectiveness;
            result[0].isk_sp = state.lsi_price / result[0].sp;
            result[1].isk_sp = state.ssi_price / result[1].sp;
        }

        return result;
    }

    get_accelerator_isk_sp(): ISKForSPItemData[] {
        const props = this.props;
        const state = this.state;

        if (props.biology_skill_level == null || props.biology_implant_multiplier == null) {
            return state.accelerators.map((accel) => ({
                type_id: accel.type_id,
                image_type_id: 48582,
                name: accel.name.replace(" Cerebral Accelerator", ""),
                price: accel.price,
                sp: null,
                isk_sp: null,
                sp_day: null,
            }));
        }

        const level = state.fake_biology_5 ? 5 : props.biology_skill_level;
        const implant = state.fake_implant ? 1.1 : props.biology_implant_multiplier;

        const duration_mult = implant * (1 + 0.2 * level);
        const all_mults = duration_mult / 40;

        return state.accelerators.map((accel) => {
            const sp = all_mults * accel.duration * accel.magnitude;
            return {
                type_id: accel.type_id,
                image_type_id: 48582,
                name: accel.name.replace(" Cerebral Accelerator", ""),
                price: accel.price,
                sp,
                isk_sp: accel.price / sp,
                sp_day: (sp * 86400) / accel.duration / duration_mult,
            };
        });
    }

    on_fake_bio5(e) {
        this.setState({fake_biology_5: e.target.checked});
    }

    on_fake_implant(e) {
        this.setState({fake_implant: e.target.checked});
    }

    render() {
        const props = this.props;
        const state = this.state;
        if (state.lsi_price == null || state.ssi_price == null) {
            return <div className="isk_sp loading" />;
        }

        let sources = this.get_accelerator_isk_sp().concat(this.get_injector_isk_sp());
        if (props.biology_skill_level == null) {
            sources = sources.sort((a, b) => a.price - b.price);
        } else {
            sources = sources.sort((a, b) => a.isk_sp! - b.isk_sp!);
        }

        const prices = sources.map((source) => source.price);
        const formatter = get_formatter(prices);

        const elements = sources.map((s) => (
            <ISKForSPPanelItem formatter={formatter} key={s.type_id} {...s} />
        ));

        const extra_controls: JSX.Element[] = [];
        if (this.props.millions_of_sp != null && state.accelerators.length) {
            if (this.props.biology_implant_multiplier != 1.1) {
                extra_controls.push(
                    <label
                        key="i"
                        title="Simulate your character having the Biology BY-810 implant."
                    >
                        BY-810 Implant:
                        <input
                            type="checkbox"
                            onChange={(e) => this.on_fake_implant(e)}
                            checked={state.fake_implant}
                        />
                    </label>
                );
            }

            if (props.biology_skill_level != 5) {
                extra_controls.push(
                    <label
                        key="s"
                        title="Caculate ISK/SP values for Accelerators as if your character has Biology V."
                    >
                        Biology V:
                        <input
                            type="checkbox"
                            onChange={(e) => this.on_fake_bio5(e)}
                            checked={state.fake_biology_5}
                        />
                    </label>
                );
            }
        }

        return (
            <div className="isk_sp">
                {extra_controls}
                <table>
                    <thead>
                        <tr>
                            <td style={{paddingRight: "16px"}}>Name</td>
                            <td>Price</td>
                            <td>SP</td>
                            <td>SP/Day</td>
                            <td>ISK/SP</td>
                        </tr>
                    </thead>
                    <tbody>{elements}</tbody>
                </table>
                <div className="isk_sp_explanation">
                    Using sell prices from Jita and nearby public Citadels.
                </div>
            </div>
        );
    }
}
