export enum Type {
    TextNode,
    FormattedNode,
    InlineOpen,
    InlineClose,
    PotentialTag
}

export interface Interface {
    type: Type,
    value: string | Array<Interface>
}

export function ise(token: Type, val: string | Array<Interface>): Interface {
    return {
        type: token,
        value: val
    };
}
