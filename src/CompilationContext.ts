/** API for compilation context configuration. */
export interface CompilationContext {
    /** Resolved base directory. Defaults to current directory. */
    readonly baseDirectory: string;

    /** Resolved path to source files. */
    readonly sourceFiles: string[];

    /** Resolved output directory. Defaults to ${baseDirectory}/build. */
    readonly outputDirectory: string;

    /** Defines weather or not the compiler will generate navigable HTML reproducing the session. */
    generateReplicaSite: boolean;

    /** Defines weather or not the compiler will generate and archive with all output files. */
    generateArchive: boolean;

    /**
     * Defines the base directory for relative path resolution.
     *
     * @param path Path to the base directory.
     *
     * @returns The current instance of compilation context to chain calls
     */
    baseDir(path: string): this;

    /**
     * Add a file or a directory to the pool of files to compile.
     *
     * @param path Path of a file of directory containing session data.
     *
     * @returns The current instance of compilation context to chain calls
     */
    source(path: string): this;

    /**
     * Add several files or a directories to the pool of files to compile.
     *
     * @param paths Paths of several files of directories containing session data.
     *
     * @returns The current instance of compilation context to chain calls
     */
    sources(...paths: string[]): this;
}
