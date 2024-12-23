import React from "react";
import CharacterSkills from "../character_skills";
import {StaticSkill, skill_data} from "../static_skill_data";
import {attribute_types, sp_required} from "../misc/sp";
import {format_duration, format_with_decimals} from "../misc/formatting";
import SkillRequirementTree from "./skill_requirement_tree";
import SkillCostsForCharacter from "./skill_costs_for_character";
import Skill from "./skill";

enum SkillsToDisplay {
    all_skills = 0,
    injected_skills,
}

enum SkillsSorting {
    ingame = 0,
    sp,
    level,
}
interface SkillCategoryProps {
    on_category_click: (number) => void;
    name: string;
    skills: StaticSkill[];
    expanded: boolean;
    id: number;
}

interface FocusedSkillProps {
    skill_id: number;
    onClose: () => void;
}

interface FocusedSkillState {
    description: string | null;
}

class FocusedSkill extends React.Component<FocusedSkillProps, FocusedSkillState> {
    constructor(props) {
        super(props);
        this.state = {description: null};
        this.on_close = this.on_close.bind(this);
    }

    componentDidMount() {
        this.fetch_skill_data();
    }

    componentDidUpdate(prevProps: FocusedSkillProps) {
        if (this.props.skill_id != prevProps.skill_id) {
            this.fetch_skill_data();
        }
    }

    async fetch_skill_data() {
        const skill_id = this.props.skill_id;
        let response: Response;
        // ESI API can just decide to fail sometimes, retrying can sometimes fix it.
        response = await fetch(`https://esi.evetech.net/latest/universe/types/${skill_id}/`);
        if (response.status > 502 && response.status < 504) {
            response = await fetch(`https://esi.evetech.net/latest/universe/types/${skill_id}/`);
        }
        if (!response.ok) {
            const body = await response.text();
            throw Error(`ESI failed with ${response.status}: ${body}`);
        }
        const json = await response.json();
        if (this.props.skill_id != skill_id) {
            return;
        }
        this.setState({description: json.description});
    }

    on_close() {
        this.props.onClose();
    }

    render() {
        const skill: StaticSkill = skill_data.skill(this.props.skill_id);
        const attribs = attribute_types[skill.attribute].split("/");
        return (
            <div className="focused_skill">
                <div className="focused_skill_header" onClick={this.on_close}>
                    <h3>
                        <img
                            width={32}
                            height={32}
                            src="https://images.evetech.net/types/3452/icon?size=64"
                        />
                        {skill.name}
                    </h3>
                    <div className="focused_skill_close">x</div>
                </div>
                <div className="focused_skill_flexbox">
                    <table className="focused_skill_details">
                        <tbody>
                            <tr>
                                <th>Rank:</th>
                                <td>{skill.rank}x</td>
                            </tr>
                            <tr>
                                <th>Primary Attr:</th>
                                <td className="attribute_primary">{attribs[0]}</td>
                            </tr>
                            <tr>
                                <th>Secondary Attr:</th>
                                <td className="attribute_secondary">{attribs[1]}</td>
                            </tr>
                            <tr>
                                <th>Level 1:</th>
                                <td>{format_with_decimals(sp_required(1, skill.rank), 0)} SP</td>
                            </tr>
                            <tr>
                                <th>Level 2:</th>
                                <td>{format_with_decimals(sp_required(2, skill.rank), 0)} SP</td>
                            </tr>
                            <tr>
                                <th>Level 3:</th>
                                <td>{format_with_decimals(sp_required(3, skill.rank), 0)} SP</td>
                            </tr>
                            <tr>
                                <th>Level 4:</th>
                                <td>{format_with_decimals(sp_required(4, skill.rank), 0)} SP</td>
                            </tr>
                            <tr>
                                <th>Level 5:</th>
                                <td>{format_with_decimals(sp_required(5, skill.rank), 0)} SP</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="focused_skill_description">
                        {this.state.description === null ? (
                            <img width={64} height={64} src="s/loading.svg" />
                        ) : (
                            this.state.description
                        )}
                    </p>
                </div>
            </div>
        );
    }
}

class SkillCategory extends React.PureComponent<SkillCategoryProps, Record<string, never>> {
    on_click = () => {
        this.props.on_category_click(this.props.id);
    };

    render() {
        return (
            <div
                onClick={this.on_click}
                className={"skill_category " + (this.props.expanded ? "expanded" : "")}
                data-cid={this.props.id}
            >
                <h4>{this.props.name}</h4>
                <span>{this.props.skills.length}</span>
            </div>
        );
    }
}

interface SkillCategoriesProps {
    on_category_change: (number) => void;
    active_category: number | null;
}

class SkillCategories extends React.PureComponent<SkillCategoriesProps, Record<string, never>> {
    render() {
        const children = skill_data.categories.map((category) => {
            return (
                <SkillCategory
                    key={category.id}
                    {...category}
                    on_category_click={this.props.on_category_change}
                    expanded={category.id === this.props.active_category}
                />
            );
        });

        return <div className="skill_categories">{children}</div>;
    }
}

interface SkillsProps {
    skills: StaticSkill[] | null;
    data: CharacterSkills | null;
    display: SkillsToDisplay;
    sort: SkillsSorting;
    training_levels: {[skill_id: number]: number | undefined};
}

interface SkillsState {
    focused_skill: number | null;
}

class Skills extends React.Component<SkillsProps, SkillsState> {
    constructor(props) {
        super(props);
        this.state = {focused_skill: null};
        this.on_focus_close = this.on_focus_close.bind(this);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.skills != this.props.skills) {
            this.setState({focused_skill: null});
        }
    }

    on_skill_click = (skill_id: number) => {
        this.setState({focused_skill: skill_id});
    };

    render_skill = (skill: StaticSkill, desired_level?: number) => {
        const char_skills = this.props.data ? this.props.data.skills : {};
        return (
            <Skill
                desired_level={desired_level}
                key={skill.id}
                {...char_skills[skill.id]}
                {...skill}
                on_skill_click={this.on_skill_click}
                training_level={this.props.training_levels[skill.id] || 0}
                sp_min={this.props.data ? this.props.data.sp_per_minute(skill.attribute) : 0}
            />
        );
    };

    on_focus_close() {
        this.setState({focused_skill: null});
    }

    render() {
        if (this.state.focused_skill !== null) {
            return (
                <React.Fragment>
                    <FocusedSkill
                        skill_id={this.state.focused_skill}
                        onClose={this.on_focus_close}
                    />
                    <SkillCostsForCharacter
                        skill={skill_data.skill(this.state.focused_skill)}
                        char_skills={this.props.data}
                    />
                    <SkillRequirementTree
                        skill={skill_data.skill(this.state.focused_skill)}
                        skillComponentRenderer={this.render_skill}
                    />
                </React.Fragment>
            );
        }
        if (!this.props.skills) {
            return <h3>Select a Category</h3>;
        }
        const char_skills = this.props.data ? this.props.data.skills : {};
        let skills = this.props.skills.slice();
        if (this.props.display == SkillsToDisplay.injected_skills) {
            skills = skills.filter((skill) => char_skills[skill.id]);
        }

        if (this.props.sort != SkillsSorting.ingame) {
            skills = skills.sort((s1, s2) => {
                const cs1 = char_skills[s1.id];
                const cs2 = char_skills[s2.id];
                if (!cs1) {
                    return !cs2 ? 0 : 1;
                }
                if (!cs2) {
                    return -1;
                }
                if (this.props.sort == SkillsSorting.level) {
                    return cs2.level - cs1.level;
                } else if (this.props.sort == SkillsSorting.sp) {
                    return cs2.sp - cs1.sp;
                } else {
                    throw Error();
                }
            });
        }

        const skill_doms = skills.map((skill) => this.render_skill(skill));

        return <div className="skill_list">{skill_doms}</div>;
    }
}

interface SkillBrowserProps {
    data: CharacterSkills | null;
}

interface SkillBrowserState {
    search: string;
    display: SkillsToDisplay;
    sort: SkillsSorting;
    category_id: number | null;
}

export default class SkillBrowser extends React.PureComponent<
    SkillBrowserProps,
    SkillBrowserState
> {
    constructor(props) {
        super(props);
        this.state = {
            search: "",
            display: SkillsToDisplay.all_skills,
            sort: SkillsSorting.ingame,
            category_id: null,
        };
        this.on_sort_change = this.on_sort_change.bind(this);
        this.on_display_change = this.on_display_change.bind(this);
        this.on_category_change = this.on_category_change.bind(this);
        this.on_search_change = this.on_search_change.bind(this);
    }

    on_display_change(event) {
        this.setState({display: Number(event.target.value)});
    }

    on_sort_change(event) {
        this.setState({sort: Number(event.target.value)});
    }

    on_category_change(category_id: number) {
        this.setState({
            category_id,
            search: "",
        });
    }

    on_search_change(event) {
        this.setState({search: event.target.value});
    }
    render() {
        const char_skills = this.props.data;
        const training_levels: {[skill_id: number]: number} = {};
        if (char_skills) {
            char_skills.skill_queue
                .slice()
                .reverse()
                .forEach((skill) => {
                    if (!training_levels[skill.id]) {
                        training_levels[skill.id] = skill.level;
                    }
                });
        }

        let skills_to_show: StaticSkill[] | null = null;
        if (this.state.search.length > 1) {
            const needle = new RegExp(this.state.search, "i");
            skills_to_show = skill_data.skills.filter((skill) => skill.name.search(needle) >= 0);
        } else if (this.state.category_id) {
            skills_to_show = skill_data.category(this.state.category_id).skills;
        }

        return (
            <div className="skill_browser">
                <div style={{textAlign: "right"}}>
                    <input
                        onChange={this.on_search_change}
                        className="skill_search"
                        type="search"
                        placeholder="Search skills..."
                        value={this.state.search}
                    />
                </div>
                <SkillCategories
                    active_category={this.state.category_id}
                    on_category_change={this.on_category_change}
                />
                <select value={this.state.display} onChange={this.on_display_change}>
                    <option value={SkillsToDisplay.all_skills}>All Skills</option>
                    <option value={SkillsToDisplay.injected_skills}>My Skills</option>
                </select>
                <select value={this.state.sort} onChange={this.on_sort_change}>
                    <option value={SkillsSorting.ingame}>Sort By In-Game</option>
                    <option value={SkillsSorting.sp}>Sort By SP</option>
                    <option value={SkillsSorting.level}>Sort By Level</option>
                </select>
                <Skills
                    display={this.state.display}
                    sort={this.state.sort}
                    skills={skills_to_show}
                    data={char_skills}
                    training_levels={training_levels}
                />
            </div>
        );
    }
}
