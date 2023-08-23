import * as chai from 'chai';
import * as fs from 'fs';
import * as C from '../dist/json-schema/sessionCapture.schema';
import { createCompilationContext } from '../dist/lib/main';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chaiFiles = require('chai-files');

chai.use(chaiFiles);

const { expect } = chai;
const { file } = chaiFiles;

const baseDir = 'build/test-output';

describe('Session compiler tests', () => {
    it('Extract timings from session S3', () => {
        const timings: { ts: number; ets: number | undefined; lts: number | undefined }[] = [];
        let timingsCsv = 'Chunk,LOM,Event\n';
        const t0 = 1648196401443;

        fs.readdirSync('tests/resources/s3')
            .filter((f) => f.endsWith('.json'))
            .forEach((f) => {
                const chunk = JSON.parse(fs.readFileSync(`tests/resources/s3/${f}`, 'utf8')) as C.SessionCapture;
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

    it('Try compilation of session S1', async () => {
        const sessionId = 'b43daf55-05c1-408b-96d8-6c58dd96d733';
        const outputDir = `${baseDir}/compilation/s1`;
        const context = createCompilationContext('./');
        context.outputDir(outputDir);
        context.source('tests/resources/s1');
        await context.compileSession();

        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.json`)).to.exist;

        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.zip`)).to.exist;
    });

    it('Try compilation of session S2', async () => {
        const sessionId = '002581ae-60cc-4945-b5b3-2ee74393b6e9';
        const outputDir = `${baseDir}/compilation/s2`;
        const context = createCompilationContext('./');
        context.outputDir(outputDir);
        context.source('tests/resources/s2');
        await context.compileSession();

        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.json`)).to.exist;
        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.zip`)).to.exist;
    });

    it('Try compilation of session S3', async () => {
        const sessionId = '003bfa93-f58b-4617-9e8c-45abf69109c0';
        const outputDir = `${baseDir}/compilation/s3`;
        const context = createCompilationContext('./');
        context.outputDir(outputDir);
        context.source('tests/resources/s3');
        await context.compileSession();

        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.json`)).to.exist;
        // eslint-disable-next-line no-unused-expressions
        expect(file(`${outputDir}/${sessionId}/session.zip`)).to.exist;
    });
});
