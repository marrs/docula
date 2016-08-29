// Definitions:
//   * tag - char or string that represents a formatting node
//   * text - char or string to be presented in document
//

import token = require('./token');
import { rules } from "./formatting-rules"

function is_string(x: any) {
    return Object.prototype.toString.call(x) === "[object String]";
}

function is_whitespace(c: string): boolean {
    return c === " " || c === "\t" || c === ''? true: false;
}

function peek(arr: Array<any>) {
    return arr[arr.length -1];
}

function has_non_inline_tag_char(str: string): boolean {
    for (var i = 0, len = str.length; i < len; ++i) {
        if (false === has_inline_tag_char(str[i])) {
            return true;
        }
    }
    return false;
}

function has_inline_tag_char(str: string): boolean {
    return str !== "" && "*_/-`".indexOf(str) > -1;
}

function quote(str: string): string {
    return '"' + str + '"';
}

export function build_possible_tags_list(tkn: token.Interface, rules: Object): Array<token.Interface> {
    if (false === is_string(tkn.value)) {
        throw new Error("This function does not support nested tokens");
    }
    if (has_non_inline_tag_char(<string> tkn.value)) {
        throw new Error("non-tag characters detected");
    }
    var tokens: Array<token.Interface> = [];
    var value = <string>tkn.value;
    for (var i = value.length; i >= 0; --i) {
        for (var j in rules) {
            var substr = value.substr(0, i)
            var rem = value.substring(i, value.length);
            if ( substr === rules[j].prefix) {
                tokens.push({
                    type: tkn.type,
                    value: substr
                });
                if (rem.length) {
                    tokens = tokens.concat(build_possible_tags_list({
                        type: tkn.type,
                        value: rem
                    }, rules));
                }
            }
        }
    }
    return tokens;
}

export function scan_block_for_nodes(str: string) {
    const strlen = str.length;

    var subNode = {token: token.ise(token.Type.TextNode, ''), offset: 0};
    var strBuffer = '';
    var tagBuffer = (function() { // TODO Rewrite this to be a generic buffer
        var buffer = '';
        var isOpen = false;
        var precedingChar = '';
        var tagType: token.Type;
        return {
            open: function(char: string, prevChar: string) {
                buffer = char;
                isOpen = true;
                precedingChar = prevChar;
                // TODO: Move this branch out of here
                if (has_inline_tag_char(precedingChar)) {
                    throw new Error("Cannot open a tag buffer when previous char is also a tag");
                }
            },
            try_append: function(char: string): boolean {
                if (this.is_open()) {
                    buffer += char;
                    return true;
                } else return false;
            },
            reset: function() {
                buffer = '';
                isOpen = false;
            },
            close: function(followingChar: string) {
                if (has_inline_tag_char(followingChar)) {
                    throw new Error("Cannot close a tag buffer when next char is also a tag");
                }
                // TODO: Put this in a function of its own
                if (is_whitespace(precedingChar)) {
                    if (is_whitespace(followingChar)) {
                        tagType = token.Type.TextNode;
                    } else {
                        tagType = token.Type.InlineOpen;
                    }
                } else if (is_whitespace(followingChar)) {
                    tagType = token.Type.InlineClose;
                } else {
                    tagType = token.Type.TextNode;
                }
                // END TODO
                isOpen = false;
                var reset = this.reset;
                return {
                    then_flush: function(fn) {
                        var str = buffer;
                        fn(token.ise(tagType, str)); // TODO Don't tokenise
                        reset();
                    }
                };
            },
            is_open: function(): boolean {
                return isOpen;
            }
        };
    }());
    var current = '';
    var prev= '';
    var next = '';
    var tokenList: Array<token.Interface[]> = [];

    // TODO: When we capture a node char, we need to store it so that we
    // can later decide if it is valid or not.

    for (var i = 0; i < strlen; ++i) {
        current = str[i];
        prev = str[i-1] || '';
        next = str[i+1];
        if (tagBuffer.is_open()) {
            if (has_inline_tag_char(current)) {
                tagBuffer.try_append(current);
            } else {
                tagBuffer.close(current).then_flush(function(tkn) {
                    if (tkn.type === token.Type.TextNode) {
                        strBuffer += tkn.value + current;
                    } else {
                        if (strBuffer.length) {
                            tokenList.push([token.ise(token.Type.TextNode, strBuffer)]);
                            strBuffer = '';
                        }
                        tokenList.push(build_possible_tags_list(tkn, rules.inline));
                        strBuffer += current;
                    }
                });
            }
        } else {
            if (has_inline_tag_char(current)) {
                tagBuffer.open(current, prev);
            } else {
                strBuffer += current;
            }
        }
    }
    if (strBuffer) {
        tokenList.push([token.ise(token.Type.TextNode, strBuffer)]);
    }
    return tokenList;
}
