import {testArticle} from "./tests-utils";


for(var i=1; i<=25; i++) {
    testArticle("2015", `2015-${i<10?'0':''}${i}`);
}
