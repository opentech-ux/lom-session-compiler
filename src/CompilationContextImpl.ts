import * as fs from 'fs';
import path from 'path';
import { CompilationContext } from './CompilationContext';
import { SessionCompiler } from './SessionCompiler';

/** Implementation of {@link CompilationContext}. */
export class CompilationContextImpl implements CompilationContext {
    private _outputDir: string;

    private readonly _sourceFiles: string[] = [];

    public readonly baseDirectory: string;

    public generateReplicaSite = true;

    public generateArchive = true;

    constructor(baseDir = '.') {
        if (!fs.existsSync(baseDir) || !fs.lstatSync(baseDir).isDirectory())
            throw new Error(`${baseDir} is not a valid directory.`);
        this.baseDirectory = fs.realpathSync(baseDir);
        this._outputDir = path.resolve(this.baseDirectory, 'build');
    }

    public get outputDirectory() {
        return this._outputDir;
    }

    public get sourceFiles(): readonly string[] {
        return this._sourceFiles;
    }

    public outputDir(outputDir: string): this {
        this._outputDir = path.resolve(this.baseDirectory, outputDir);
        return this;
    }

    source(filePath: string): this {
        const realFilePath = fs.realpathSync(path.resolve(this.baseDirectory, filePath));
        const isFilePathIsDirectory = fs.lstatSync(realFilePath).isDirectory();

        if (isFilePathIsDirectory) {
            this._sourceFiles.push(
                ...fs
                    .readdirSync(realFilePath)
                    .filter((file) => file.endsWith('.json'))
                    .map((json) => fs.realpathSync(path.resolve(realFilePath, json)))
            );
        } else {
            this._sourceFiles.push(realFilePath);
        }
        return this;
    }

    public sources(...paths: string[]): this {
        paths.forEach((filePath) => this.source(filePath));
        return this;
    }

    async compileSession(): Promise<string[]> {
        return await SessionCompiler.create(this);
    }
}
