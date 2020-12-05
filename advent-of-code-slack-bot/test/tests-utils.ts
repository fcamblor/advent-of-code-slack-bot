import {htmlToSlackMarkdown} from "../main/utils";
import * as fs from "fs";
import * as fetch from 'node-fetch';
import * as cheerio from 'cheerio';


export function testArticle(directory: string, date: string) {
    test('Article conversion for '+date, () => {
        const article = fs.readFileSync(`./test/${directory}/${date}.article.html`).toString('utf-8');
        const expectation = fs.readFileSync(`./test/${directory}/${date}.expectation.md`).toString('utf-8');
        expect(htmlToSlackMarkdown(article).trim()).toBe(expectation.trim());
    })
}

export async function createTestDataFor(year: string, day: string, sessionCookie: string) {
    return fetch(`https://adventofcode.com/${year}/day/${Number(day)}`, {
        method: 'GET',
        headers: {
            "Cookie": `session=${sessionCookie}`
        },
        redirect: 'follow'
    }).then(response => response.text())
      .then(html => {
          const $ = cheerio.load(html);

          let htmlArticle = cheerio.html($("article"), {
              normalizeWhitespace: false,
              xmlMode: true,
              decodeEntities: false
          });
          fs.writeFileSync(`./test/${year}/${year}-${day}.article.html`, htmlArticle);
          fs.writeFileSync(`./test/${year}/${year}-${day}.expectation.md`, htmlToSlackMarkdown(htmlArticle));
      })
      .catch(error => console.log('error', error));
}

export function generateTestDataFor(year: string, startDay: number, lastDay: number, sessionCookie: string) {
    if(!fs.existsSync(`./test/${year}`)) {
        fs.mkdirSync(`./test/${year}`);
    }

    for(var day=startDay; day<=lastDay; day++) {
        const paddedDay = (day<10?"0":"")+day;
        test(`creating sample data for ${year}-${paddedDay}`, (done) => {
            createTestDataFor(year, paddedDay, sessionCookie)
                .then(() => {
                    console.log(`Sample data for ${year}-${paddedDay} loaded successfully !`);
                    done()
                });
        });
    }

}
