import {testArticle} from "./tests-utils";


test('ok', () => console.log("This is an empty test (to be able to execute the suite from IJ)"));
for(var i=1; i<=5; i++) {
    testArticle("2022", `2022-${i<10?'0':''}${i}`, false);
}
