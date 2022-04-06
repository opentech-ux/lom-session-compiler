import 'chai';

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const chaiFiles = require('chai-files');

// chai.use(chaiFiles);
//
// const { expect } = chai;
// const { file } = chaiFiles;
//
// const baseDir = 'build/test-output';

describe('Session compiler tests', () => {
    // it('Should fail on non existent baseDir', () => {
    //     const invalidBaseDir = 'non/existent/path';
    //
    //     expect(() => new SessionCompiler(invalidBaseDir)).to.throw(`${invalidBaseDir} is not a valid directory.`);
    // });
    //
    // it('Should fail on non directory baseDir', () => {
    //     const invalidBaseDir = 'package.json';
    //
    //     expect(() => new SessionCompiler(invalidBaseDir)).to.throw(`${invalidBaseDir} is not a valid directory.`);
    // });
    //
    // it('Should generate some HTML files (without baseDir)', () => {
    //     const folderName = 'basic-lom';
    //
    //     new SessionCompiler()
    //         .source('tests/resources/basic-lom/basic.lom.json')
    //         .outputDir(`${baseDir}/${folderName}`)
    //         .compile();
    //
    //     expect(file(`${baseDir}/${folderName}/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/otherPage/index.html`)).to.exist;
    // });
    //
    // it('Should generate some HTML files (with baseDir)', () => {
    //     const folderName = 'script-lom';
    //
    //     new SessionCompiler(baseDir)
    //         .source('../../tests/resources/script-lom/script.lom.json')
    //         .outputDir(folderName)
    //         .compile();
    //
    //     expect(file(`${baseDir}/${folderName}/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/about/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/contact/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/index/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/location/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/price/index.html`)).to.exist;
    // });
    //
    // it('Should generate some HTML files (with multiple json files)', () => {
    //     const folderName = 'multi-lom';
    //
    //     new SessionCompiler(baseDir).source('../../tests/resources/multi-lom').outputDir(folderName).compile();
    //
    //     expect(file(`${baseDir}/${folderName}/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/about/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/contact/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/index/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/location/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/price/index.html`)).to.exist;
    //     expect(file(`${baseDir}/${folderName}/otherPage/index.html`)).to.exist;
    // });
});
