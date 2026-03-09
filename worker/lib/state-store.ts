/**
 * Simple State Store with subscriptions - adapted from @cf-vibesdk/sdk
 */

type Listener<T> = (value: T) => void;

export class StateStore<T> {
	private listeners = new Set<Listener<T>>();

	constructor(private value: T) {}

	get(): T {
		return this.value;
	}

	set(value: T): void {
		this.value = value;
		this.notify();
	}

	update(fn: (value: T) => T): void {
		this.value = fn(this.value);
		this.notify();
	}

	onChange(listener: Listener<T>): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener(this.value);
		}
	}
}

/**
 * Simple event emitter
 */
type EventMap = Record<string, unknown[]>;

export class TypedEmitter<T extends EventMap> {
	private listeners = new Map<keyof T, Set<(...args: unknown[]) => void>>();

	on<K extends keyof T>(
		event: K,
		listener: (...args: T[K]) => void,
	): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners
			.get(event)!
			.add(listener as (...args: unknown[]) => void);
		return () => this.off(event, listener);
	}

	off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
		this.listeners
			.get(event)
			?.delete(listener as (...args: unknown[]) => void);
	}

	emit<K extends keyof T>(event: K, ...args: T[K]): void {
		this.listeners.get(event)?.forEach((listener) => listener(...args));
	}
}
