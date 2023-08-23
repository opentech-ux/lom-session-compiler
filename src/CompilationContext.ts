/** API for compilation context configuration. */
export interface CompilationContext {
    /** Resolved base directory. */
    readonly baseDirectory: string;

    /** Resolved path to source files. */
    readonly sourceFiles: readonly string[];

    /** Resolved output directory. Defaults to ${baseDirectory}/build. */
    readonly outputDirectory: string;

    /** Defines weather or not the compiler will generate an HTML site reproducing the session. Defaults to true. */
    generateReplicaSite: boolean;

    /** Defines weather or not the compiler will generate and archive with all output files. Defaults to true. */
    generateArchive: boolean;

    /**
     * Add a file or a directory to the pool of files to compile.
     *
     * @param path Path of a file of directory containing session data.
     *
     * @returns The current instance of compilation context to chain calls
     */
    source(path: string): this; // eslint-disable-line no-unused-vars

    /**
     * Add several files or a directories to the pool of files to compile.
     *
     * @param paths Paths of several files of directories containing session data.
     *
     * @returns The current instance of compilation context to chain calls
     */
    sources(...paths: string[]): this; // eslint-disable-line no-unused-vars

    /**
     * Defines the directory in which the compiler will be generated files.
     *
     * @param path Path of the directory to use for output files.
     *
     * @returns The current instance of compilation context to chain calls
     */
    outputDir(path: string): this; // eslint-disable-line no-unused-vars

    /**
     * Compile the session chunks accordingly to the settings defined in this context.
     *
     * @returns Returns a list of compiled session ids
     */
    compileSession(): Promise<string[]>;
}
