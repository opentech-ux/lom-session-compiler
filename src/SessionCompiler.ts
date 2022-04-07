import * as fs from 'fs';
import JSZip from 'jszip';
import type { Lom, LomId, Session, TimelineElement } from '@opentech-ux/session-model';
import { CompilationContext } from './CompilationContext';
import { SessionCapture } from '../build/json-schema/sessionCapture.schema';

/** Class implementing the session compilation process. */
export class SessionCompiler {
    private readonly context: CompilationContext;

    constructor(context: CompilationContext) {
        this.context = context;
    }

    private static addToTimeline(timeline: TimelineElement[], element: TimelineElement) {
        if (timeline.length === 0) {
            timeline.push(element);
            return;
        }
        let index = timeline.length;
        while (index > 0 && timeline[index - 1].timeStamp > element.timeStamp) index -= 1;
        timeline.splice(index, 0, element);
    }

    public compile(): void {
        let sessionId: string | undefined;
        let userId: string | undefined;
        const chunks: SessionCapture[] = [];

        // Step 1 : Load all session chunks in RAM
        this.context.sourceFiles.forEach((file) => {
            const chunk = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionCapture;
            if (!sessionId) sessionId = chunk.sid;
            else if (sessionId !== chunk.sid)
                throw new Error(`Inconsistent session IDs in ${file}, ${sessionId} expected, but was ${chunk.sid}`);
            if (!userId) userId = chunk.uid;
            chunks.push(chunk);
        });
        if (!sessionId) throw new Error(`Empty session`);

        // Step 2 : Sort chunks by timestamp
        chunks.sort((a, b) => b.ts - a.ts);

        // Step 3 : Build the session timeline
        const timeline: TimelineElement[] = [];
        const loms: { [id: LomId]: Lom } = {};
        chunks.forEach((chunk) => {
            chunk.loms?.forEach((lom) => {
                // if (lom.ref) SessionCompiler.addToTimeline(timeline, SessionCompiler.createLomTransitionEvent(lom as LomRef));
            });
        });

        // Step 4 : Detect LOM transitions
        // TODO Detect LOM transitions

        // Step 5 : Write resulting session object to output directory
        const session: Session = { sessionId, timeStamp: chunks[0].ts, userId, loms, timeline };
        const sessionJSON = JSON.stringify(session);
        fs.writeFileSync(`${this.context.outputDirectory}/session.json`, sessionJSON, 'utf8');

        // Step 6 : Build replay HTML site
        const generatedHtmlFiles: { [k: string]: string } = {};
        if (this.context.generateReplicaSite) {
            // TODO Build replica site
            const indexFile = `${this.context.outputDirectory}/replay/index.html`;
            fs.writeFileSync(indexFile, 'TEST', 'utf8');
            generatedHtmlFiles['replay/index.html'] = indexFile;
        }

        // Step 7 : Create archive
        if (this.context.generateArchive) {
            const zip = new JSZip();
            zip.file('session.json', sessionJSON);
            Object.entries(generatedHtmlFiles).forEach(([path, file]) => {
                zip.file(path, fs.readFileSync(file, 'utf8'));
            });
            zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }).pipe(
                fs.createWriteStream(`${this.context.outputDirectory}/session.zip`)
            );
        }
    }
}
