import { CompilationContext } from './CompilationContext';

/**
 * @description Main class to compile the LOM data.
 *
 * @export
 * @class SessionCompiler
 */
export class SessionCompiler {
    private readonly context: CompilationContext;

    constructor(context: CompilationContext) {
        this.context = context;
    }

    public compile(): void {
        console.debug(this.context);
        // this.context.sourceFiles.forEach((file) => {
        //     const lomModel = JSON.parse(fs.readFileSync(file, 'utf8')) as LomModel;
        //     const rootPath = lomModel.rootPath.rooted();
        //
        //     Object.keys(lomModel.loms).forEach((subPath) => {
        //         const lom = lomModel.loms[subPath];
        //         const lomPath = path.posix.join(rootPath, subPath.unRooted());
        //         const lomDir = path.resolve(this._outputDirectory, lomPath.unRooted());
        //
        //         fs.mkdirSync(lomDir, { recursive: true });
        //
        //         const lomArray: Zone[] = [];
        //         this._mapZone(lom, lomArray);
        //         // lomArray.sort((a, b) => a.bounds.width - b.bounds.width);
        //
        //         const html = `
        //             <!DOCTYPE html>
        //             <html lang='en'>
        //               <head>
        //                 <meta charset='utf-8'>
        //                 <title>LOM at ${lomPath}</title>
        //               </head>
        //               <body style='overflow-x:hidden;'>
        //                 ${this._mapZoneHTML(lomArray, lomPath)}
        //               </body>
        //             </html>
        //         `.replace(/^\s{10,20}/gm, '');
        //
        //         fs.writeFileSync(`${lomDir}/index.html`, html, 'utf8');
        //     });
        // });
    }

    // private _mapZone(lom: Zone, lomArray: Zone[], level = 0): void {
    //     if (lom.children && lom.children.length > 0)
    //         lom.children.forEach((child) => this._mapZone(child, lomArray, level + 1));
    //
    //     // eslint-disable-next-line no-param-reassign
    //     lom.level = level;
    //
    //     lomArray.push(lom);
    // }
    //
    // private _mapZoneHTML(lomArray: Zone[], lomPath: string): string {
    //     const htmlArray: string[] = [];
    //     lomArray.forEach((lom) => {
    //         htmlArray.push(this._buildZoneDiv(lom, lomPath));
    //     });
    //     return htmlArray.join('\n');
    // }

    // eslint-disable-next-line class-methods-use-this
    // private _buildZoneDiv(zone: Zone, lomPath: string): string {
    //     const b = zone.bounds;
    //
    //     let css = `position:absolute; left:${b.x}px; top:${b.y}px; width:${b.width}px; height:${b.height}px;`;
    //     css += ` border:${zone.style?.border || '1px solid black'};`;
    //     css += ` background:${zone.style?.background || 'white'};`;
    //     css += ` z-index:${zone.link ? 999999 : zone.level};`;
    //
    //     const attributes: Attributes = { style: css };
    //
    //     if (zone.link) {
    //         const href = path.posix.isAbsolute(zone.link) ? path.posix.relative(lomPath, zone.link) : zone.link;
    //
    //         attributes.style += ' cursor: pointer;';
    //
    //         const hrefPath = `'${zone.link === '/' || lomPath === '/' ? '' : '../'}${href || '.'}/index.html'`;
    //
    //         attributes.onclick = `javascript:location.href=${hrefPath}`;
    //     }
    //
    //     return createHtmlElement({
    //         name: 'div',
    //         // html: content,
    //         attributes,
    //     });
    // }
}