var expect = require('chai').expect;
var app = require('../build/index.js');
var rules = require('../build/formatting-rules').rules;

// TODO: Inline tags cannot be used to format other tag chars! Create spec for
// this
//
// TODO: Create spec for valid inline tag.
//   * Must contain only chars in inline-tag dictionary
//
// TODO:
//   * Text must begin with a non-tag char unless that char does not in itself
//     form a tag.
//   * Text can end with a tag char
//   * A prefix-only tag must be terminated by first whitespace or tag char
//     after text string.
//   * A prefix-only tag must not have a wrapping tag between it and the text
//     string.
//
//  TODO: Done, but specs required
//   * Define prefix and suffix tags:
//     * Prefix:
//       - tag with whitespace or inline tag to left and text or inline tag
//         to right
//       - if tag has tag to its left, that tag must have tag or whitespace
//         to its left, and so on recursively
//       - if tag has tag to its right, that tag must have tag or text to its
//         right, and so on recursively
//     * Suffix:
//       - is tag with text or inline tag to left and whitespace to right
//       - remaining rules as per prefix
//
// TODO: Implement tag identification algorithm.
// Compound tags must be untangled using following rules
//   [*] If entire tag string at beginning matches a rule's prefix and entire
//       string at end matches the same rule's suffix, you have found the tag.
//   [*] Else, repeat check for next largest prefix string omitting char from
//       inside and working your way out. Then keep going until you are down
//       to one char.
//   [ ] If still no match, check suffix for tag that has no prefix, identify
//       as a tag and repeat above steps with remaining tag chars.
//
//  TODO: Handle duplicate tags and which to convert to text nodes
//    * If ** is a wrapping tag, **foo** should mean {**}[foo]{**}
//    * Else, the outer wrapping tag takes precedence.
//    * If you wish the inner tag to take precedence then you must indicate
//      with wrappers.
//      *  **foo**   should mean {*}[*foo*]{*}
//      *  *\*foo*/* should mean [*]{*}[foo]{*}[*]
//
//    * In order to prevent a formatting paradox, a tag that is used as a
//      wrapping tag cannot be used as a non-wrapping tag. e.g. *foo cannot
//      be a thing if *foo* can, so even if **foo* could be made to make
//      sense (e.g. by interpreting it as {*}(*)[foo]{*}, the rule simply
//      isn't allowed to exist. In the above example, if the outer pair were
//      defined as bold formatters then the remaining tag would be interpreted
//      as text and likewise, if a * tag was identified as unbalanced (prefix,
//      suffix, or both) then the outer pair of * tokens would be converted
//      to text as the innermost tag takes precedence for unbalanced formatting
//
//    * There is no issue with the same tag being used to identify 2 separate
//      formatting rules if one is a prefix only and the other is suffix only
//
//
//
//  INLINE PARSER
//  -------------
//
//  Pass 1 - Identify tag and text tokens
//  Pass 2 - Build AST

var tokenTypes = {
    TextNode: 0,
    FormattedNode: 1,
    InlineOpen: 2,
    InlineClose: 3,
    PotentialTag: 4
};

describe('build_possible_tags_list', function() {
    it("requires a token containing only tag characters", function() {
        expect(function() { app.build_possible_tags_list({
            type: tokenTypes.InlineOpen,
            value: 'asdf'
        }, rules.inline); }).to.throw("non-tag characters detected");
    });

    it("returns an array containing a single token if only one tag char is passed", function() {
        var token = {
            type: tokenTypes.InlineOpen,
            value: '*'
        };
        expect(app.build_possible_tags_list(token, rules.inline)).to.eql([token]);
    });

    it("returns an array containing a single token if the whole string is matched", function() {
        var token = {
            type: tokenTypes.InlineOpen,
            value: '___'
        };
        
        var inlineRules = {
            underline: {
                prefix: '_',
                suffix: '_'
            },
            doubleunderline: {
                prefix: '__',
                suffix: '__'
            },
            tripleunderline: {
                prefix: '___',
                suffix: '___'
            }
        };
        expect(app.build_possible_tags_list(token, inlineRules)[0]).to.eql(token);
    });

    it("matches the longest availble string regardless of where is starts from", function() {
        var inlineRules = {
            underline: {
                prefix: '_',
                suffix: '_'
            },
            doubleunderline: {
                prefix: '__',
                suffix: '__'
            },
            bold: {
                prefix: '*',
                suffix: '*'
            }
        };
        var tokenProto = { type: tokenTypes.InlineOpen };
        var result = Object.assign({}, tokenProto, { value: '__' });
        expect(app.build_possible_tags_list(Object.assign({}, tokenProto, {value: '__*'}), inlineRules)).to.contain(result);
        expect(app.build_possible_tags_list(Object.assign({}, tokenProto, {value: '*__'}), inlineRules)).to.contain(result);
    });

    it("matches the outermost longest availble string if there is more than one possible match", function() {
        var inlineRules = {
            validtag: {
                prefix: '__',
                suffix: '__'
            },
            validsubtag: {
                prefix: '_',
                suffix: '_'
            }
        };
        var tokenProto = { type: tokenTypes.InlineOpen };
        expect(app.build_possible_tags_list(Object.assign({}, tokenProto, {value: '___'}), inlineRules)[0]).to.eql(Object.assign({}, tokenProto, { value: '__' }));
        expect(app.build_possible_tags_list(Object.assign({}, tokenProto, {value: '___'}), inlineRules)[1]).to.eql(Object.assign({}, tokenProto, { value: '_'}));
    });
});
describe('scan_block_for_nodes', function() {
    it("puts an unformatted string into a single node of the node list", function() {
        expect(app.scan_block_for_nodes('asdf')).to.eql([[{ type: tokenTypes.TextNode, value: "asdf" }]]);
    });

    it("correctly identifies md chars that cannot be formatting nodes", function() {
        expect(app.scan_block_for_nodes('as`df')).to.eql([[{ type: tokenTypes.TextNode, value: "as`df" }]]);
    });

    describe("separatation of potential md nodes from text nodes", function() {
        it("correctly identifies a md char with no char before it and a text char after it as a potential inline opener", function() {
            expect(app.scan_block_for_nodes('*as`df')).to.eql([
                [{ type: tokenTypes.InlineOpen, value: "*" }],
                [{ type: tokenTypes.TextNode, value: "as`df" }]
            ]);
        });

        it("correctly identifies a md char with whitespace before it and a text char after it as a potential inline opener", function() {
            expect(app.scan_block_for_nodes(' *as`df')).to.eql([
                [{ type: tokenTypes.TextNode, value: " " }],
                [{ type: tokenTypes.InlineOpen, value: "*" }],
                [{ type: tokenTypes.TextNode, value: "as`df" }]
            ]);
        });
    });

});

describe.skip('scan_block', function() {
    it("puts an unformatted string into a single node of the AST", function() {
        expect(app.scan_block('asdf')).to.eql([{ type: tokenTypes.TextNode, value: "asdf" }]);
    });

    it("ignores inline md that do not touch whitespace", function() {
        expect(app.scan_block('as`df')).to.eql([{ type: tokenTypes.TextNode, value: "as`df" }]);
    });

    it("expects value to be an array of tokens if token is a formatted node", function() {
        expect(app.scan_block('`asdf`')[0].type).to.eql(tokenTypes.FormattedNode);
        expect(app.scan_block('`asdf`')[0].value).to.be.an('array');
    });

    it("adds branch to AST for inline tags that are opened and closed", function() {
        expect(app.scan_block('`asdf`')).to.eql([
            {
                type: tokenTypes.FormattedNode,
                value: [
                    {
                        type: tokenTypes.InlineOpen,
                        value: "`"
                    },
                    {
                        type: tokenTypes.TextNode,
                        value: "asdf"
                    },
                    {
                        type: tokenTypes.InlineClose,
                        value: "`"
                    }
                ]
            }
        ]);

    });

    // TODO: Cannot be fixed until tags are properly implemented
    it("captures neighbouring inline tokens if they are nested", function() {
        console.log('asdf', app.scan_block("_*underline bold*_")[0].value[0].value);
        //expect(app.scan_block("_*underline bold*_")[0].value[0].type).to.eq(tokenTypes.InlineOpen);
        expect(app.scan_block("_*underline bold*_")[0].value[0].value).to.eq('_');
        /*
        expect(app.scan_block("_*underline bold*_")).to.eql([
            {
                type: tokenTypes.FormattedNode,
                value: [
                    {
                        type: tokenTypes.InlineOpen,
                        value: "_"
                    },
                    {
                        type: tokenTypes.FormattedNode,
                        value: [
                            {
                                type: tokenTypes.InlineOpen,
                                value: "*"
                            },
                            {
                                type: tokenTypes.TextNode,
                                value: "underline bold"
                            },
                            {
                                type: tokenTypes.InlineClose,
                                value: "*"
                            },
                        ]
                    },
                    {
                        type: tokenTypes.InlineClose,
                        value: "_"
                    }
                ]
            }
        ]);
        */
    });
});
