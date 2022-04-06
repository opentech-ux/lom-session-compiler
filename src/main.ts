import { CompilationContext } from './CompilationContext';
import { CompilationContextImpl } from './CompilationContextImpl';

/**
 * Creates a compilation context to prepare the compilation of session capture chunks.
 *
 * @param baseDir base directory to resolve relative path to source files or target directory. Defaults to current dir.
 */
export function createCompilationContext(baseDir = '.'): CompilationContext {
    return new CompilationContextImpl(baseDir);
}
