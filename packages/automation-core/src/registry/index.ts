import type { EventHandler } from '../events/index.js';

export interface AutomationHandlerDefinition {
  readonly name: string;
  readonly eventType: string;
  readonly handler: EventHandler;
}

export class AutomationRegistry {
  private readonly handlers = new Map<string, AutomationHandlerDefinition[]>();

  public register(definition: AutomationHandlerDefinition): void {
    const existing = this.handlers.get(definition.eventType) ?? [];
    existing.push(definition);
    this.handlers.set(definition.eventType, existing);
  }

  public getHandlers(eventType: string): readonly AutomationHandlerDefinition[] {
    return this.handlers.get(eventType) ?? [];
  }

  public listEventTypes(): readonly string[] {
    return [...this.handlers.keys()];
  }
}
