/** Base class for captured events. */
import {
    AbstractEvent,
    ActionEvent,
    ExplorationEvent,
    LomTransitionEvent,
    Session,
    Lom,
} from '@opentech-ux/session-model';

/** Extension of AbstractEvent permitting LOM reference definition. */
export interface AbstractEventBuilder extends AbstractEvent {
    /** Writable ID of the LOM in which the event occurred. */
    lom: string;
}

/** Extension of ExplorationEvent permitting LOM reference definition. */
export interface ExplorationEventBuilder extends ExplorationEvent, AbstractEventBuilder {
    /** Writable ID of the LOM in which the event occurred. */
    lom: string;
}

/** Extension of ActionEvent permitting LOM reference definition. */
export interface ActionEventBuilder extends ActionEvent, AbstractEventBuilder {
    /** Writable ID of the LOM in which the event occurred. */
    lom: string;
}

/** Alias for elements that can appear in the session timeline. */
export type TimelineElementBuilder = ExplorationEventBuilder | ActionEventBuilder | LomTransitionEvent;

/** An UX session with IDs, LOMs, exploration events and action events. */
export interface SessionBuilder extends Session {
    readonly sessionId: string;
    readonly parentId: string | null;
    readonly nextId: string | null;
    readonly timeStamp: number;
    readonly userId?: string;
    readonly loms: { [k: string]: Lom };
    readonly timeline: TimelineElementBuilder[];
}
