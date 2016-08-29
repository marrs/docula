/// <reference path="node.d.ts" />
import * as fs from "fs"

export var rules = JSON.parse(fs.readFileSync(__dirname + "/../formatting.example.json", 'utf8'));
