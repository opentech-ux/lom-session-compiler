import * as fs from 'fs';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';
import type * as M from '@opentech-ux/session-model';
import { CompilationContext } from './CompilationContext';
import type * as C from '../build/json-schema/sessionCapture.schema';
import { ActionEventBuilder, ExplorationEventBuilder, SessionBuilder, TimelineElementBuilder } from './model';

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

    private readonly timeline: TimelineElementBuilder[] = [];

    private readonly session: SessionBuilder;

    private currentChunk: number;

    private previousFaultyTs = 0;

    private lomDeduplicationMapping: { [k: string]: string } = {};

    private lomCounter = 1;

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

        this.chunks.sort((a, b) => a.ts - b.ts);

        this.context = context;
        this.session = { sessionId, timeStamp: this.chunks[0].ts, userId, loms: this.loms, timeline: this.timeline };
        this.currentChunk = 0;
    }

    private relativizeTimestampToSession(ts: number): number {
        if (ts >= 0) return Math.round(ts + this.chunks[this.currentChunk].ts - this.session.timeStamp);

        // Fix negative timestamps caused by faulty event capture
        let docTs = ts + this.chunks[this.currentChunk].ts;
        if (docTs < this.previousFaultyTs) {
            docTs += this.previousFaultyTs;
        }
        this.previousFaultyTs = docTs;
        return Math.round(docTs);
    }

    private addToTimeline(element: TimelineElementBuilder) {
        if (this.timeline.length === 0) {
            this.timeline.push(element);
            return;
        }
        let index = this.timeline.length;
        while (index > 0 && this.timeline[index - 1].timeStamp > element.timeStamp) index -= 1;
        this.timeline.splice(index, 0, element);
    }

    private createExplorationEvent(ee: C.ExplorationEvent): ExplorationEventBuilder {
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

    private createActionEvent(ae: C.ActionEvent): ActionEventBuilder {
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

    private findSimilarLom(lom: M.Lom): string | undefined {
        function isSimilarTo(otherLom: M.Lom, tolerance = 20): boolean {
            return (
                Math.abs(lom.pageWidth - otherLom.pageWidth) <= tolerance &&
                Math.abs(lom.pageHeight - otherLom.pageHeight) <= tolerance &&
                areSimilar(lom.root, otherLom.root, tolerance)
            );
        }

        function areSimilar(z1: M.Zone, z2: M.Zone, tolerance: number): boolean {
            return (
                areCoincident(z1.bounds, z2.bounds, tolerance) &&
                z1.children.length === z2.children.length &&
                z1.children.every((c, i) => areSimilar(c, z2.children[i], tolerance))
            );
        }

        function areCoincident(b1: M.Bounds, b2: M.Bounds, tolerance: number): boolean {
            return (
                Math.abs(b1.x - b2.x) <= tolerance &&
                Math.abs(b1.y - b2.x) <= tolerance &&
                Math.abs(b1.width - b2.width) <= tolerance &&
                Math.abs(b1.height - b2.height) <= tolerance
            );
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const lomId of Object.keys(this.loms)) {
            if (isSimilarTo(this.loms[lomId])) return lomId;
        }
        return undefined;
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

        function findZone(lom: M.Lom, id: string): M.Zone | undefined {
            function doFindZone(zone: M.Zone): M.Zone | undefined {
                if (zone.zoneId === id) return zone;
                // eslint-disable-next-line no-restricted-syntax
                for (const c of zone.children) {
                    const found = doFindZone(c);
                    if (found) return found;
                }
                return undefined;
            }

            return doFindZone(lom.root);
        }

        // Step 1 : Build the session timeline
        this.chunks.forEach((chunk, index) => {
            this.currentChunk = index;
            chunk.loms?.forEach((lomOrRef) => {
                const lomTs = this.relativizeTimestampToSession(lomOrRef.ts);
                if ('r' in lomOrRef) {
                    const lom = createLom(lomOrRef);
                    const similarLomId = this.findSimilarLom(lom);
                    if (similarLomId) {
                        if (lomOrRef.id) this.lomDeduplicationMapping[lomOrRef.id] = similarLomId;
                        this.addToTimeline(createLomTransition(similarLomId, lomTs));
                    } else {
                        // eslint-disable-next-line no-plusplus
                        const lomId = `l${String(this.lomCounter++).padStart(3, '0')}`;
                        if (lomOrRef.id) this.lomDeduplicationMapping[lomOrRef.id] = lomId;
                        this.loms[lomId] = lom;
                        this.addToTimeline(createLomTransition(lomId, lomTs));
                    }
                } else this.addToTimeline(createLomTransition(this.lomDeduplicationMapping[lomOrRef.ref], lomTs));
            });
            chunk.ee?.forEach((ee) => this.addToTimeline(this.createExplorationEvent(ee)));
            chunk.ae?.forEach((ae) => this.addToTimeline(this.createActionEvent(ae)));
        });

        // Step 2 : Detect LOM transitions
        let curLomId: M.LomId | undefined;
        let lastActionEvent: ActionEventBuilder | undefined;
        let lastExplorationEvent: ExplorationEventBuilder | undefined;
        this.timeline.forEach((event) => {
            switch (event.t) {
                case 'Transition':
                    if (curLomId) {
                        if (lastActionEvent && lastActionEvent.timeStamp > event.timeStamp - 1_000) {
                            const fromZone = findZone(this.loms[curLomId], lastActionEvent.zoneId);
                            fromZone?.transitions?.push({ targetLom: event.target, eventType: 'click' });
                        } else if (lastExplorationEvent) {
                            // TODO retrieve zone for hover events triggering a transition
                            // const fromZone = findZone(this.loms[curLomId], lastExplorationEvent.zoneId);
                            // fromZone?.transitions?.push({ targetLom: event.target, eventType: 'hover' });
                        }
                    }
                    curLomId = event.target;
                    break;
                case 'Action':
                    // eslint-disable-next-line no-param-reassign
                    event.lom = curLomId || '';
                    lastActionEvent = event;
                    break;
                case 'Exploration':
                    // eslint-disable-next-line no-param-reassign
                    event.lom = curLomId || '';
                    lastExplorationEvent = event;
                    break;
                default:
            }
        });

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
