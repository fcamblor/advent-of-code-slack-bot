import {htmlToSlackMarkdown} from "../main/utils";
import * as fs from "fs";


export function testArticle(directory: string, date: string) {
    test('Article conversion for '+date, () => {
        const article = fs.readFileSync(`./test/${directory}/${date}.article.html`).toString('utf-8');
        const expectation = fs.readFileSync(`./test/${directory}/${date}.expectation.md`).toString('utf-8');
        expect(htmlToSlackMarkdown(article).trim()).toBe(expectation.trim());
    })
}