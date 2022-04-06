/* eslint-disable no-unused-expressions */

import { expect } from 'chai';
import path = require('path');
import { createCompilationContext } from '../src/main';

describe('Compilation context tests', () => {
    it('Should fail on non existent baseDir', () => {
        const badBaseDir = 'non/existent/path';
        expect(() => createCompilationContext(badBaseDir)).to.throw(`${badBaseDir} is not a valid directory.`);
    });

    it('Should fail on non directory baseDir', () => {
        const badBaseDir = 'package.json';
        expect(() => createCompilationContext(badBaseDir)).to.throw(`${badBaseDir} is not a valid directory.`);
    });

    it('Test the correct creation of compilation context', () => {
        const context = createCompilationContext('tests/resources');
        expect(context.generateArchive).to.be.true;
        expect(context.generateReplicaSite).to.be.true;
        expect(context.baseDirectory).to.match(/.*tests.resources$/);
        expect(context.outputDirectory).to.match(/.*tests.resources.build$/);
    });

    it('Test the correct configuration of output dir', () => {
        const context = createCompilationContext('tests/resources');
        context.outputDir('other-build-dir');
        expect(context.outputDirectory).to.match(/.*tests.resources.other-build-dir$/);
    });

    it('Test the correct configuration of source files', () => {
        const context = createCompilationContext('tests/resources/s2');
        context.sources('1649090598998.json', '1649090609035.json', '1649090619077.json');
        expect(context.sourceFiles).to.have.members([
            `${context.baseDirectory}${path.sep}1649090598998.json`,
            `${context.baseDirectory}${path.sep}1649090609035.json`,
            `${context.baseDirectory}${path.sep}1649090619077.json`,
        ]);
    });

    it('Test the correct configuration of source files by directory', () => {
        const context = createCompilationContext('tests/resources/s2');
        context.source('.');
        expect(context.sourceFiles).to.have.members([
            `${context.baseDirectory}${path.sep}1649090598998.json`,
            `${context.baseDirectory}${path.sep}1649090609035.json`,
            `${context.baseDirectory}${path.sep}1649090619077.json`,
            `${context.baseDirectory}${path.sep}1649090629036.json`,
            `${context.baseDirectory}${path.sep}1649090639068.json`,
            `${context.baseDirectory}${path.sep}1649090649049.json`,
        ]);
        expect(context.sourceFiles).to.not.include(`${context.baseDirectory}${path.sep}irrelevant.txt`);
    });
});
