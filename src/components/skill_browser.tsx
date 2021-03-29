import React from "react";
import CharacterSkills from "../character_skills";
import {StaticSkill, skill_data} from "../static_skill_data";
import {attribute_types, sp_required} from "../misc/sp";
import {format_duration} from "../misc/formatting";

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
    onClick: any;
    name: string;
    skills: StaticSkill[];
    expanded: boolean;
    id: number;
}

interface SkillProps {
    sp_min: number | null;
    training_level: number;
    id: number;
    category_id: number;
    name: string;
    description: string;
    rank: number;
    attribute: number;
    level: number | undefined;
    sp: number | undefined;
}

const single_attribute_doms = {
    intelligence: (
        <span key="i" className="intelligence">
            I
        </span>
    ),
    memory: (
        <span key="m" className="memory">
            M
        </span>
    ),
    perception: (
        <span key="p" className="perception">
            P
        </span>
    ),
    willpower: (
        <span key="w" className="willpower">
            W
        </span>
    ),
    charisma: (
        <span key="c" className="charisma">
            C
        </span>
    ),
};

const attribute_doms: {[attribute: number]: React.Component[]} = {};
attribute_types.forEach((value, key) => {
    attribute_doms[key] = value.split("/").map((v) => single_attribute_doms[v]);
});

class Skill extends React.PureComponent<SkillProps, {}> {
    render() {
        const props = this.props;
        let class_name = "s";
        let next_level = 1;
        if (props.level != null) {
            const training_level = props.training_level ? props.training_level - props.level : 0;
            class_name = `s s${props.level}_${training_level}`;
            next_level = Math.max(props.level, props.training_level) + 1;
        }

        let skill_time: any | null = null;
        if (props.sp_min && next_level < 6) {
            const last_level_sp = sp_required(next_level - 1, props.rank);
            const sp_to_train =
                sp_required(next_level, props.rank) -
                Math.max(0, (props.sp || 0) - last_level_sp) -
                last_level_sp;
            const duration = (sp_to_train / props.sp_min) * 60;

            skill_time = <span className="skill_time">{format_duration(duration)}</span>;
        }

        return (
            <div
                title={`${props.description}\n\n${props.sp_min} SP/min`}
                className={`skill${props.level != null ? "" : " not_injected"}`}
            >
                <span className="skill_lhand_details">
                    <span className={class_name}></span>
                    <h5>{props.name}</h5>
                    {skill_time}
                </span>
                <span className="skill_attribute">{attribute_doms[props.attribute]}</span>
            </div>
        );
    }
}
class SkillCategory extends React.PureComponent<SkillCategoryProps, {}> {
    render() {
        return (
            <div
                onClick={this.props.onClick}
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
    on_category_change: any;
    active_category: number | null;
}

class SkillCategories extends React.PureComponent<SkillCategoriesProps, {}> {
    render() {
        const children = skill_data.categories.map((category) => {
            return (
                <SkillCategory
                    key={category.id}
                    {...category}
                    onClick={this.props.on_category_change.bind(this, category.id)}
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

class Skills extends React.Component<SkillsProps, {}> {
    render() {
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

        const skill_doms = skills.map((skill) => (
            <Skill
                key={skill.id}
                {...char_skills[skill.id]}
                {...skill}
                training_level={this.props.training_levels[skill.id] || 0}
                sp_min={this.props.data ? this.props.data.sp_per_minute(skill.attribute) : 0}
            />
        ));

        return (
            <>
                <div className="skill_list">{skill_doms}</div>
            </>
        );
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