import {htmlToSlackMarkdown} from "../main/utils";
import * as fs from "fs";
import * as fetch from 'node-fetch';
import {AllHtmlEntities} from 'html-entities';


export function testArticle(directory: string, date: string) {
    test('Article conversion for '+date, () => {
        // Trying to open 'fixed' article prior to standard one
        // (yes, I had to fix some articles because some of them fetched from the site have errors inside it that are
        // fixed by the browser, and are then not visible to human eyes)
        let filename = `${date}.article.fixed.html`;
        if(!fs.existsSync(`./test/${directory}/${filename}`)) {
            filename = `${date}.article.html`;
        }

        const article = fs.readFileSync(`./test/${directory}/${filename}`).toString('utf-8');
        const expectation = fs.readFileSync(`./test/${directory}/${date}.expectation.md`).toString('utf-8');
        expect(htmlToSlackMarkdown(article).trim()).toBe(expectation.trim());
    })
}

export async function createTestDataFor(year: string, day: string, fetchArticles: boolean, sessionCookie: string) {
    const articleFetchedPromise: Promise<void> = (!fetchArticles)?Promise.resolve(null):fetch(`https://adventofcode.com/${year}/day/${Number(day)}`, {
        method: 'GET',
        headers: {
            "Cookie": `session=${sessionCookie}`
        },
        redirect: 'follow'
    }).then(response => response.text())
      .then(html => {
          let firstHtmlArticle = "<article" + html.split("<article")[1];
          firstHtmlArticle = firstHtmlArticle.split("</article>")[0] + "</article>";

          let allHtmlEntities = new AllHtmlEntities();
          firstHtmlArticle = allHtmlEntities.decode(firstHtmlArticle);
          fs.writeFileSync(`./test/${year}/${year}-${day}.article.html`, firstHtmlArticle);
      })
      .catch(error => console.log('error', error));

    articleFetchedPromise.then(() => {
        // Trying to open 'fixed' article prior to standard one
        // (yes, I had to fix some articles because some of them fetched from the site have errors inside it that are
        // fixed by the browser, and are then not visible to human eyes)
        let filename = `${year}-${day}.article.fixed.html`;
        if(!fs.existsSync(`./test/${year}/${filename}`)) {
            filename = `${year}-${day}.article.html`;
        }

        const htmlArticle = fs.readFileSync(`./test/${year}/${filename}`).toString('utf-8');
        fs.writeFileSync(`./test/${year}/${year}-${day}.expectation.md`, htmlToSlackMarkdown(htmlArticle));
    });
}

export function generateTestDataFor(year: string, startDay: number, lastDay: number, fetchArticles: boolean, sessionCookie: string) {
    if(!fs.existsSync(`./test/${year}`)) {
        fs.mkdirSync(`./test/${year}`);
    }

    for(var day=startDay; day<=lastDay; day++) {
        const paddedDay = (day<10?"0":"")+day;
        test(`creating sample data for ${year}-${paddedDay}`, (done) => {
            createTestDataFor(year, paddedDay, fetchArticles, sessionCookie)
                .then(() => {
                    console.log(`Sample data for ${year}-${paddedDay} loaded successfully !`);
                    done()
                });
        });
    }

}
