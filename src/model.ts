/** Base class for captured events. */
import { AbstractEvent, ActionEvent, ExplorationEvent, LomTransitionEvent, Session } from '@opentech-ux/session-model';

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

/** An UX session with LOMs, exploration events and action events. */
export interface SessionBuilder extends Session {
    /** List of events of this session in chronological order. */
    readonly timeline: TimelineElementBuilder[];
}
