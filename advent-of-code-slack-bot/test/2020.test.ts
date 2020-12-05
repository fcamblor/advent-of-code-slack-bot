import {testArticle} from "./tests-utils";


for(var i=1; i<=5; i++) {
    testArticle("2020", `2020-${i<10?'0':''}${i}`);
}
