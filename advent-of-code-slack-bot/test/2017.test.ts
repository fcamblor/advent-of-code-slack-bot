import {testArticle} from "./tests-utils";


for(var i=1; i<=25; i++) {
    testArticle("2017", `2017-${i<10?'0':''}${i}`);
}
