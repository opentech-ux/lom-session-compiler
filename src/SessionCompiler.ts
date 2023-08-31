import * as fs from 'fs/promises';
import JSZip from 'jszip';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type * as M from '@opentech-ux/session-model';
import { CompilationContext } from './CompilationContext';
import type * as C from '../dist/json-schema/sessionCapture.schema';
import { LIMIT_SESSION_ACTIVE, LIMIT_SESSION_RECOVERY } from './config/constants/session.constant';
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

    private chunksGeneral: C.SessionCapture[] = [];

    private currentChunk: number;

    private previousFaultyTs = 0;

    private lomDeduplicationMapping: { [k: string]: string } = {};

    private lomCounter = 1;

    private constructor(
        context: CompilationContext,
        chunks: C.SessionCapture[],
        chunksGeneral: C.SessionCapture[],
        timeStamp: number,
        sessionId: string,
        parentId: string | null,
        nextId: string | null,
        userId?: string
    ) {
        this.context = context;
        this.chunks = chunks;
        this.session = { sessionId, parentId, nextId, timeStamp, userId, loms: this.loms, timeline: this.timeline };
        this.currentChunk = 0;
        this.chunksGeneral = chunksGeneral;
    }

    public static async create(context: CompilationContext): Promise<string[]> {
        let sessionId: string | undefined;
        let userId: string | undefined;
        const chunks: C.SessionCapture[] = [];

        await Promise.all(
            context.sourceFiles.map(async (file) => {
                const chunk = JSON.parse(await fs.readFile(file, 'utf8')) as C.SessionCapture;
                if (!sessionId) sessionId = chunk.sid;
                else if (sessionId !== chunk.sid)
                    throw new Error(`Inconsistent session IDs in ${file}, ${sessionId} expected, but was ${chunk.sid}`);
                if (!userId) userId = chunk.uid;
                chunks.push(chunk);
            })
        );

        if (!sessionId) throw new Error(`Empty session`);
        chunks.sort((a, b) => a.ts - b.ts);

        return this.sessionFragmentation(context, chunks, sessionId, userId);
    }

    /**
     * Fragmentation of sessions based on their period of inactivity
     *
     * @param context Compilation context
     * @param chunks Chunks of the session obtained by to the context
     * @param sessionId The session identifier
     * @param userId The user identifier
     *
     * @returns List of generated identifiers corresponding to each fragmented session
     */
    private static async sessionFragmentation(
        context: CompilationContext,
        chunks: C.SessionCapture[],
        sessionId: string,
        userId?: string
    ): Promise<string[]> {
        let activeSession: C.SessionCapture[] = [];
        let inactiveSession: C.SessionCapture[] = [];
        let sessionsId: string[] = [];
        let isInactive = false;
        const parentId = sessionId;
        let nextId = uuidv4();
        let currentId = uuidv4();

        // eslint-disable-next-line no-restricted-syntax
        for (const [index, chunk] of chunks.entries()) {
            // Case 1: The first action (T0)
            if (index === 0) {
                activeSession.push({ ...chunk });

                // eslint-disable-next-line no-continue
                continue;
            }

            // Case 2: Active session
            if (!isInactive) {
                const acChunksTreated: Record<string, C.SessionCapture[] | string[] | boolean | string> =
                    // eslint-disable-next-line no-await-in-loop
                    await this.getActiveChunks(
                        context,
                        chunks,
                        chunk,
                        activeSession,
                        LIMIT_SESSION_ACTIVE,
                        index,
                        sessionsId,
                        parentId,
                        currentId,
                        isInactive,
                        userId
                    );

                // Set data updated
                activeSession = acChunksTreated.session as C.SessionCapture[];
                sessionsId = acChunksTreated.sessionsId as string[];
                isInactive = acChunksTreated.isInactive as boolean;
                currentId = acChunksTreated.currentId as string;
            }

            // Case 3: Inctive session
            if (isInactive) {
                const chunksTreated: Record<string, C.SessionCapture[] | string[] | boolean | string> =
                    // eslint-disable-next-line no-await-in-loop
                    await this.getInactiveChunks(
                        context,
                        chunks,
                        chunk,
                        inactiveSession,
                        LIMIT_SESSION_RECOVERY,
                        sessionsId,
                        parentId,
                        currentId,
                        nextId,
                        isInactive,
                        userId
                    );

                // Set data updated
                inactiveSession = chunksTreated.inactiveSession as C.SessionCapture[];
                activeSession = chunksTreated.activeSession as C.SessionCapture[];
                sessionsId = chunksTreated.sessionsId as string[];
                isInactive = chunksTreated.isInactive as boolean;
                currentId = chunksTreated.currentId as string;
                nextId = chunksTreated.nextId as string;
            }
        }

        return sessionsId;
    }

    /**
     * Get the active chunks of a session
     *
     * @param context Compilation context
     * @param chunks Chunks of the session obtained by to the context
     * @param chunk The current active chunk
     * @param session List of active chunks of the session
     * @param limitSession Estimated inactivity time limit
     * @param index Current iteration index
     * @param sessionsId List of generated identifiers corresponding to each fragmented session
     * @param parentId The source session identifier
     * @param currentId The current session identifier
     * @param isInactive Session activity flag
     * @param userId The user identifier
     *
     * @returns Updated session informatio
     */
    static async getActiveChunks(
        context: CompilationContext,
        chunks: C.SessionCapture[],
        chunk: C.SessionCapture,
        session: C.SessionCapture[],
        limitSession: number,
        index: number,
        sessionsId: string[],
        parentId: string,
        currentId: string,
        isInactive: boolean,
        userId?: string
    ) {
        const previousChunk: C.SessionCapture = session[session.length - 1];
        const isLastChunk: boolean = index === chunks.length - 1;

        const getIds = () =>
            sessionsId.length === 0 ? { pid: null, cip: parentId } : { pid: parentId, cip: currentId };

        // Check: The elapsed time between the previous and current chunk is within the accepted uptime.
        if (limitSession <= this.minElapsed(previousChunk.ts, chunk.ts) || isLastChunk) {
            // If it is the last chunk, close the session with it
            if (isLastChunk) session.push({ ...chunk });

            // To the last saved chunk, add the time of inactivity
            const sessionEndedTs = previousChunk.ts + limitSession * 60000;

            // Get the currentId and parentId if applicable
            const { pid, cip }: Record<string, string | null> = getIds();

            // Close and send the session
            await new SessionCompiler(context, session, chunks, sessionEndedTs, cip, pid, null, userId).compile(cip);

            // Start the inactivity
            // eslint-disable-next-line no-param-reassign
            isInactive = true;
            // eslint-disable-next-line no-param-reassign
            session = [];

            // Reset the active session
            // eslint-disable-next-line no-param-reassign
            currentId = uuidv4();

            // Save the generated session ID
            sessionsId.push(cip);
        } else session.push({ ...chunk });

        return {
            session,
            sessionsId,
            isInactive,
            currentId,
        };
    }

    /**
     * Get the inactive chunks of a session
     *
     * @param context Compilation context
     * @param chunk The current inactive chunk
     * @param session List of inactive chunks of the session
     * @param limitSessionInactive Estimated time limit to restart the activity
     * @param sessionsId List of generated identifiers corresponding to each fragmented session
     * @param parentId The source session identifier
     * @param currentId The source session identifier
     * @param nextId The new session identifier to be started
     * @param isInactive Session activity flag
     * @param userId The user identifier
     *
     * @returns Updated session information
     */
    static async getInactiveChunks(
        context: CompilationContext,
        chunks: C.SessionCapture[],
        chunk: C.SessionCapture,
        session: C.SessionCapture[],
        limitSessionInactive: number,
        sessionsId: string[],
        parentId: string,
        currentId: string,
        nextId: string,
        isInactive: boolean,
        userId?: string
    ) {
        const previousInactiveChunk: C.SessionCapture = session[session.length - 1];
        const activeSession: C.SessionCapture[] = [];

        session.push({ ...chunk });

        // Check: The recovery of the session
        if (
            // eslint-disable-next-line no-prototype-builtins
            chunk.hasOwnProperty('loms') &&
            // eslint-disable-next-line no-prototype-builtins
            previousInactiveChunk?.hasOwnProperty('ee' || 'ae') &&
            limitSessionInactive >= this.minElapsed(previousInactiveChunk.ts, chunk.ts)
        ) {
            // Apply negative timestamp based on the time of the restart session
            // eslint-disable-next-line no-restricted-syntax
            for (const item of session) {
                item.ts -= chunk.ts;
            }

            // Remove the session that restarted the activity
            session.pop();

            // Close and send the inactive session
            await new SessionCompiler(
                context,
                session,
                chunks,
                previousInactiveChunk.ts,
                currentId,
                parentId,
                nextId,
                userId
            ).compile(currentId);

            // Start the activity
            // eslint-disable-next-line no-param-reassign
            isInactive = false;
            activeSession.push({ ...chunk });
            // eslint-disable-next-line no-param-reassign
            session = [];

            // Save the generated session ID
            sessionsId.push(currentId);

            // Reset the inactive session
            // eslint-disable-next-line no-param-reassign
            currentId = nextId;
            // eslint-disable-next-line no-param-reassign
            nextId = uuidv4();
        }

        return {
            inactiveSession: session,
            activeSession,
            sessionsId,
            isInactive,
            currentId,
            nextId,
        };
    }

    static minElapsed(previousTimestamp: number | undefined = 0, currentTimestamp: number | undefined = 0) {
        return Math.floor((currentTimestamp - previousTimestamp) / 1000 / 60);
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
                Math.abs(b1.y - b2.y) <= tolerance &&
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

    public async compile(sessionId: string) {
        function createLomTransition(id: string, ts: number): M.LomTransitionEvent {
            return { t: 'Transition', target: id, timeStamp: ts };
        }

        function createLom(lom: C.Lom): M.Lom {
            function createZone(z: C.Zone): M.Zone {
                const result: M.Zone = {
                    zoneId: z.id || randomUUID(),
                    transitions: [],
                    bounds: { x: z.b[0], y: z.b[1], width: z.b[2], height: z.b[3] },
                    style: z.s ? { background: z.s.bg, border: z.s.b } : undefined,
                    children: [],
                };
                z.c?.forEach((c) => result.children.push(createZone(c)));
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

        const lomsGeneral: C.Lom[] = [];
        this.chunksGeneral.forEach((element) => {
            element.loms?.forEach((lom) => {
                lomsGeneral.push(lom as C.Lom);
            });
        });

        const getLom = (lomOrRef: C.Lom, key: string) => {
            const lomTs = this.relativizeTimestampToSession(lomOrRef.ts);
            // eslint-disable-next-line array-callback-return, consistent-return
            const lomFound = lomsGeneral.find((element) => {
                if (element?.id === lomOrRef[key]) return element;
            });

            if (lomFound) {
                const lom = createLom(lomFound);
                const similarLomId = this.findSimilarLom(lom);

                if (similarLomId) {
                    this.addToTimeline(createLomTransition(similarLomId, lomTs));
                } else {
                    // eslint-disable-next-line no-plusplus
                    const lomId = `l${String(this.lomCounter++).padStart(3, '0')}`;
                    this.loms[lomId] = lom;
                    this.addToTimeline(createLomTransition(lomId, lomTs));
                }
            }
        };

        // Step 1 : Build the session timeline
        this.chunks.forEach((chunk, index) => {
            this.currentChunk = index;
            chunk.loms?.forEach((lomOrRef: C.Lom | C.LomRef) => {
                if (lomOrRef.ref) getLom(lomOrRef as C.Lom, 'ref');
                else getLom(lomOrRef as C.Lom, 'id');
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
        await fs.mkdir(`${this.context.outputDirectory}/${sessionId}`, { recursive: true });
        await fs.writeFile(`${this.context.outputDirectory}/${sessionId}/session.json`, sessionJSON, 'utf8');

        // Step 4 : Build replay HTML site
        const generatedHtmlFiles: { [k: string]: string } = {};
        if (this.context.generateReplicaSite) {
            // TODO Build replica site
            await fs.mkdir(`${this.context.outputDirectory}/${sessionId}/replay`, { recursive: true });
            const indexFile = `${this.context.outputDirectory}/${sessionId}/replay/index.html`;
            await fs.writeFile(indexFile, 'TEST', 'utf8');
            generatedHtmlFiles['replay/index.html'] = indexFile;
        }

        // Step 5 : Create archive
        if (this.context.generateArchive) {
            const zip = new JSZip();
            zip.file('session.json', sessionJSON);
            Object.entries(generatedHtmlFiles).forEach(([path, file]) => {
                zip.file(path, fs.readFile(file, 'utf8'));
            });
            const buffer = await zip.generateAsync({ type: 'nodebuffer', streamFiles: true });
            await fs.writeFile(`${this.context.outputDirectory}/${sessionId}/session.zip`, buffer);
        }
    }
}
