import React from "react";
import {character_url} from "../misc/urls";

interface HeadshotProps {
    id: number;
}

export default class Headshot extends React.PureComponent<HeadshotProps> {
    render() {
        const id = this.props.id;
        return (
            <img
                src={character_url(id, 64)}
                width="64"
                height="64"
                srcSet={`${character_url(id, 64)}, ${character_url(id, 128)} 2x, ${character_url(id, 256)} 4x`}
            />
        );
    }
}
