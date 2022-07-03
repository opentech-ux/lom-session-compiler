import * as chai from 'chai';
import * as fs from 'fs';
import * as C from '../build/json-schema/sessionCapture.schema';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chaiFiles = require('chai-files');

chai.use(chaiFiles);

// const { expect } = chai;
// const { file } = chaiFiles;

const baseDir = 'build/test-output';

describe('Session compiler tests', () => {
    it('Extract timings from session S3', () => {
        const timings: { ts: number; ets: number | undefined; lts: number | undefined }[] = [];
        let timingsCsv = 'Chunk,LOM,Event\n';
        const t0 = 1648196401443;

        fs.readdirSync('tests/resources/s3')
            .filter((file) => file.endsWith('.json'))
            .forEach((file) => {
                const chunk = JSON.parse(fs.readFileSync(`tests/resources/s3/${file}`, 'utf8')) as C.SessionCapture;
                const aets: number | undefined =
                    chunk.ae && chunk.ae.length ? Number(chunk.ae[0].split(':')[0]) : undefined;
                const eets: number | undefined =
                    chunk.ee && chunk.ee.length ? Number(chunk.ee[0].split(':')[0]) : undefined;
                let ets: number | undefined =
                    Math.min(aets ?? Number.POSITIVE_INFINITY, eets ?? Number.POSITIVE_INFINITY) + chunk.ts;
                ets = ets === Number.POSITIVE_INFINITY ? undefined : Math.round(ets);
                const lts = chunk.loms && chunk.loms.length ? chunk.loms[0].ts : undefined;
                timings.push({ ts: chunk.ts - t0, ets, lts });
                timingsCsv += `${chunk.ts - t0},${lts ?? ''},${ets ?? ''}\n`;
            });

        fs.mkdirSync(baseDir, { recursive: true });
        fs.writeFileSync(`${baseDir}/timings.json`, JSON.stringify(timings));
        fs.writeFileSync(`${baseDir}/timings.csv`, timingsCsv);
    });

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
