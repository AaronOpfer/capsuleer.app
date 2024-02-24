import React from "react";
import {CharacterTrainingProgress} from "../../server";
import {skill_data} from "../../static_skill_data";
import {sp_required} from "../../misc/sp";

export interface SkillProgressProps {
    training: CharacterTrainingProgress | undefined;
    current_time: Date;
}

export class SkillProgress extends React.PureComponent<SkillProgressProps> {
    render() {
        const t = this.props.training;
        if (t === undefined) {
            return <progress />;
        }
        if (t.skill_id === undefined) {
            return <progress value="0" />;
        }
        const end = +t.end_date!;
        const start = +t.start_date!;
        const now = +this.props.current_time;

        const skill = skill_data.skill(t.skill_id);
        const last_level_sp = sp_required(t.level! - 1, skill.rank);
        const next_level_sp = sp_required(t.level!, skill.rank);
        const incremental_sp_required = next_level_sp - last_level_sp;

        // it's possible that there are several levels of a given skill in the
        // skill queue. We can't see them with the abridged dataset that the
        // server sends them. However we can realize they were already trained
        // by whether the character's SP is less than the the minimum SP that
        // they would have needed to have started training this skill.
        const sp = t.sp! > last_level_sp ? t.sp! : last_level_sp;

        const time_acquired_sp = ((next_level_sp - sp) * (now - start)) / (end - start);

        const incremental_sp_acquired = time_acquired_sp + sp - last_level_sp;

        return <progress max={incremental_sp_required} value={incremental_sp_acquired} />;
    }
}
