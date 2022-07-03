import * as fs from 'fs';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';
import type * as M from '@opentech-ux/session-model';
import { CompilationContext } from './CompilationContext';
import type * as C from '../build/json-schema/sessionCapture.schema';

const reverseShortEventTypes: { [key: string]: string } = {
    S: 'scroll',
    C: 'click',
    // TODO to be completed
};

/** Class implementing the session compilation process. */
export class SessionCompiler {
    private readonly context: CompilationContext;

    private readonly chunks: C.SessionCapture[] = [];

    private readonly loms: { [k: string]: M.Lom } = {};

    private readonly timeline: M.TimelineElement[] = [];

    private readonly session: M.Session;

    private currentChunk: number;

    private lastFixedEvent: { docTs: number; sessionTs: number; chunk: number } | undefined;

    constructor(context: CompilationContext) {
        let sessionId: string | undefined;
        let userId: string | undefined;

        context.sourceFiles.forEach((file) => {
            const chunk = JSON.parse(fs.readFileSync(file, 'utf8')) as C.SessionCapture;
            if (!sessionId) sessionId = chunk.sid;
            else if (sessionId !== chunk.sid)
                throw new Error(`Inconsistent session IDs in ${file}, ${sessionId} expected, but was ${chunk.sid}`);
            if (!userId) userId = chunk.uid;
            this.chunks.push(chunk);
        });

        if (!sessionId) throw new Error(`Empty session`);

        this.chunks.sort((a, b) => b.ts - a.ts);

        this.context = context;
        this.session = { sessionId, timeStamp: this.chunks[0].ts, userId, loms: this.loms, timeline: this.timeline };
        this.currentChunk = 0;
    }

    private relativizeTimestampToSession(ts: number): number {
        if (ts > 0) return ts + this.chunks[this.currentChunk].ts - this.session.timeStamp;

        // Fix negative timestamps caused by faulty event capture
        const docTs = ts + this.chunks[this.currentChunk].ts;
        if (!this.lastFixedEvent) {
            this.lastFixedEvent = { docTs, sessionTs: docTs, chunk: this.currentChunk };
            return docTs;
        }

        if (docTs > this.lastFixedEvent.docTs) {
        }

        // if (fixedTimeStamp < this.previousFaultyTs) {
        //     // Document timebase has changed
        //     this.tsFixOffset = this.currentChunk.ts - this.session.timeStamp;
        //     this.previousFaultyTs = fixedTimeStamp;
        // }
        //
        // return fixedTimeStamp + this.tsFixOffset;
    }

    private addToTimeline(element: M.TimelineElement) {
        if (this.timeline.length === 0) {
            this.timeline.push(element);
            return;
        }
        let index = this.timeline.length;
        while (index > 0 && this.timeline[index - 1].timeStamp > element.timeStamp) index -= 1;
        this.timeline.splice(index, 0, element);
    }

    private createExplorationEvent(ee: C.ExplorationEvent): M.ExplorationEvent {
        const [ts, t, scrollPos, mousePosOrZoneId = undefined, zoneId = undefined] = ee.split(':');
        const [sx, sy] = scrollPos.split(',');
        const scrollPosition = { x: Number(sx), y: Number(sy) };
        const timeStamp = this.relativizeTimestampToSession(Number(ts));
        const type = reverseShortEventTypes[t] || t;
        let mousePosition: M.Point | undefined;
        let focusedZoneId: string | undefined = zoneId;
        if (mousePosOrZoneId) {
            if (mousePosOrZoneId.includes(',')) {
                const [mx, my] = mousePosOrZoneId.split(',');
                mousePosition = { x: Number(mx), y: Number(my) };
            } else focusedZoneId = mousePosOrZoneId;
        }
        return { t: 'Exploration', lom: '', type, timeStamp, scrollPosition, mousePosition, focusedZoneId };
    }

    private createActionEvent(ae: C.ActionEvent): M.ActionEvent {
        const [ts, t, zoneId, mousePos = undefined] = ae.split(':');
        const timeStamp = this.relativizeTimestampToSession(Number(ts));
        const type = reverseShortEventTypes[t] || t;
        let mousePosition: M.Point | undefined;
        if (mousePos) {
            const [mx, my] = mousePos.split(',');
            mousePosition = { x: Number(mx), y: Number(my) };
        }
        return { t: 'Action', lom: '', modifiers: 0, type, timeStamp, zoneId, mousePosition };
    }

    public compile() {
        function createLomTransition(id: string, ts: number): M.LomTransitionEvent {
            return { t: 'Transition', target: id, timeStamp: ts };
        }

        function createLom(lom: C.Lom): M.Lom {
            function createZone(z: C.Zone, p?: M.Zone): M.Zone {
                const result: M.Zone = {
                    parent: p,
                    zoneId: z.id || randomUUID(),
                    transitions: [],
                    bounds: { x: z.b[0], y: z.b[1], width: z.b[2], height: z.b[3] },
                    style: z.s ? { background: z.s.bg, border: z.s.b } : undefined,
                    children: [],
                };
                z.c?.forEach((c) => result.children.push(createZone(c, result)));
                return result;
            }

            return { pageWidth: lom.w, pageHeight: lom.h, root: createZone(lom.r), title: lom.t, url: lom.u };
        }

        // Step 1 : Build the session timeline
        this.chunks.forEach((chunk, index) => {
            this.currentChunk = index;
            chunk.loms?.forEach((lomOrRef) => {
                const lomTs = this.relativizeTimestampToSession(lomOrRef.ts);
                if ('r' in lomOrRef) {
                    const id = lomOrRef.id || randomUUID();
                    this.loms[id] = createLom(lomOrRef);
                    this.addToTimeline(createLomTransition(id, lomTs));
                } else this.addToTimeline(createLomTransition(lomOrRef.ref, lomTs));
            });
            chunk.ee?.forEach((ee) => this.addToTimeline(this.createExplorationEvent(ee)));
            chunk.ae?.forEach((ae) => this.addToTimeline(this.createActionEvent(ae)));
        });

        // Step 2 : Detect LOM transitions
        // TODO Detect LOM transitions

        // Step 3 : Write resulting session object to output directory
        const sessionJSON = JSON.stringify(this.session);
        fs.writeFileSync(`${this.context.outputDirectory}/session.json`, sessionJSON, 'utf8');

        // Step 4 : Build replay HTML site
        const generatedHtmlFiles: { [k: string]: string } = {};
        if (this.context.generateReplicaSite) {
            // TODO Build replica site
            const indexFile = `${this.context.outputDirectory}/replay/index.html`;
            fs.writeFileSync(indexFile, 'TEST', 'utf8');
            generatedHtmlFiles['replay/index.html'] = indexFile;
        }

        // Step 5 : Create archive
        if (this.context.generateArchive) {
            const zip = new JSZip();
            zip.file('session.json', sessionJSON);
            Object.entries(generatedHtmlFiles).forEach(([path, file]) => {
                zip.file(path, fs.readFileSync(file, 'utf8'));
            });
            zip.generateNodeStream({
                type: 'nodebuffer',
                streamFiles: true,
            }).pipe(fs.createWriteStream(`${this.context.outputDirectory}/session.zip`));
        }
    }
}
