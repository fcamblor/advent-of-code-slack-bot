
// YES, that's a crappy implementation for HTML -> Slack markdown, but I don't have a lot of time
// to dedicate to this so let's keep it simple/stupid and make it work for previous problems :)
export function htmlToSlackMarkdown(html: string) {
    var result = html;

    // Removing spaces
    result = result.split("\n").map(line => {
        return line.replace(/^\s*([^\s].*)$/, "$1");
    }).join("\n");

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

        resultWithoutParagraphs += line.trim() + (paragraphStarted?" ":"\n");
    }

    // Removing html tags
    const replacements: [RegExp,string][] = [
        [/<article[^>]*>/g, ""], [/<\/article>/g, ""],
        [/<h2[^>]*>/g, "*"], [/<\/h2>/g, "*"],
        [/<ul[^>]*>/g, ""], [/<\/ul>/g, ""],
        [/<li[^>]*>/g, "- "], [/<\/li>/g, ""],
        [/<span[^>]*>([^<]+)<\/span>/g, "$1"],
        [/<pre[^>]*><code[^>]*>/g, "```"], [/<\/code><\/pre>/g, "```"],
        [/<code[^>]*>/g, "`"], [/<\/code>/g, "`"],
        [/<em[^>]*>/g, "_"], [/<\/em>/g, "_"],
        [/<a[^>]*href="(http[^"]+)"[^>]*>([^<]+)<\/a>/g, "<$1|$2>"],
        [/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "<https://adventofcode.com$1|$2>"],
    ];
    return replacements.reduce((res, replacement) => {
        return res.replace(replacement[0], replacement[1]);
    }, resultWithoutParagraphs);
}