import { AbstractEvent, Lom } from '@opentech-ux/session-model';
import { SessionCapture } from '../build/json-schema/sessionCapture.schema';

type TimelineElement = Lom | AbstractEvent;

/** Chronological timeline in which all LOMs and events are placed during compilation. */
export class SessionTimeline {
    private readonly elements: TimelineElement[] = [];

    // eslint-disable-next-line
    addChunk(chunk: SessionCapture) {
        // TODO not yet implemented
    }
}
