
// YES, that's a crappy implementation for HTML -> Slack markdown, but I don't have a lot of time
// to dedicate to this so let's keep it simple/stupid and make it work for previous problems :)
import * as fs from "fs";

export function htmlToSlackMarkdown(html: string, debugSteps: { pathPattern: string }|undefined = undefined) {
    var result = html;

    debugStep(0, result, `At the beginning`, debugSteps);

    // Removing spaces
    let preTagStarted = false;
    result = result.split("\n").map(line => {
        const transformedLine = preTagStarted?line:line.replace(/^\s*([^\s].*)$/, "$1");

        // Avoiding to remove space in <pre> blocks
        if(line.indexOf("<pre")!==-1) { preTagStarted = true; }
        if(line.lastIndexOf("</pre") > line.lastIndexOf("<pre")) { preTagStarted = false; }

        return transformedLine;
    }).join("\n");

    debugStep(1, result, `After starting spaces replacements`, debugSteps);

    // Enforcing we have carriage returns after some closing tags like headers
    result = ["</h2>"].reduce((res, pattern) => {
        return res.replace(new RegExp(`${pattern}(\n)?`, "g"), `${pattern}\n`);
    }, result);

    debugStep(2, result, `After carriage returns replacements after headings`, debugSteps);

    var lines = result.split("\n");
    var resultWithoutParagraphs = '', paragraphStarted = false;
    for(var i=0; i<lines.length; i++) {
        var line = lines[i];
        if(line.substr(0, "<p>".length) === '<p>') {
            paragraphStarted = true;
            line = line.substr("<p>".length);
        }
        if(line.substr(0, "<li>".length) === '<li>') {
            paragraphStarted = true;
        }

        if(line.substr(-"</p>".length) === '</p>') {
            line = line.substr(0, line.length-"</p>".length);
            paragraphStarted = false;
        }
        if(line.substr(-"</li>".length) === '</li>') {
            paragraphStarted = false;
        }

        resultWithoutParagraphs += line /* .trim() */ + (paragraphStarted?" ":"\n");
    }

    debugStep(3, resultWithoutParagraphs, `After paragraphs replacements`, debugSteps);

    // Removing html tags
    const replacements: [RegExp,string][] = [
        [/<article[^>]*>/g, ""], [/<\/article>/g, ""],
        [/<h2[^>]*>/g, "*:calendar::calendar:"], [/<\/h2>/g, ":calendar::calendar:*"],
        [/<ul[^>]*>/g, ""], [/<\/ul>/g, ""],
        [/<li[^>]*>/g, "- "], [/<\/li>/g, ""],
        [/<span>(.+)<\/span>/g, "$1"],
        [/<span title="(.+)">(.+)<\/span>/g, "_($1 =>)_ $2"],
        [/<pre[^>]*><code[^>]*>/g, "```"], [/<\/code><\/pre>/g, "```"],
        [/<code[^>]*>/g, "`"], [/<\/code>/g, "`"],
        [/<em[^>]*>/g, "*"], [/<\/em>/g, "*"],
        [/<a[^>]*href="(http[^"]+)"[^>]*>([^<]+)<\/a>/g, "<$1|$2>"],
        [/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "<https://adventofcode.com$1|$2>"],
    ];
    return replacements.reduce((res, replacement, replacementIdx) => {
        const transformedContent = res.replace(replacement[0], replacement[1]);
        debugStep(replacementIdx+4, result, `After [${replacement[0].toString()}] => [${replacement[1].toString()}] replacement`, debugSteps);
        return transformedContent;
    }, resultWithoutParagraphs).trim()+"\n";
}

function debugStep(step: number, actualContent: string, comment: string, debugSteps: { pathPattern: string }|undefined): void {
    if(debugSteps) {
        fs.writeFileSync(debugSteps.pathPattern.replace("[step]", ""+(step)), `
### ${comment} :

${actualContent}`)
    }
}
