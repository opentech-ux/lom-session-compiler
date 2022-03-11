import { CompilationContext } from './CompilationContext';
import { CompilationContextImpl } from './CompilationContextImpl';

/**
 * Creates a compilation context to configure the environment in which
 * @param baseDir base directory to resolve relative path to source files or target directory. Defaults to current dir.
 */
export function createCompilationContext(): CompilationContext {
    return new CompilationContextImpl();
}
