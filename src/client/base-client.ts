import {
	createAdapter,
	createAdapterFromDatasource,
	DatabaseAdapter,
	TransactionOptions,
} from "../adapters";
import {
	applyExtension,
	Extension,
	defineExtension,
	getExtensionContext,
} from "../extensions";
import { BaseClient, ClientOptions, TransactionClientOptions } from "./types";

/**
 * Base client implementation
 * This is the base class for the generated client
 */
export class DrismifyClient implements BaseClient {
	protected adapter: DatabaseAdapter;
	protected options: ClientOptions;
	protected isConnected = false;

	constructor(options: ClientOptions) {
		this.options = options;

		// Create the adapter based on the options
		if (options.adapter) {
			this.adapter = createAdapter(options.adapter, options.datasources.db);
		} else {
			// Determine adapter type from datasource URL
			const url = options.datasources.db.url || "";
			const isLibSQL = url.startsWith("libsql:") || url.startsWith("wss:");
			const adapterType = isLibSQL ? "turso" : "sqlite";
			this.adapter = createAdapter(adapterType, options.datasources.db);
		}
	}

	/**
	 * Connect to the database
	 */
	async connect(): Promise<void> {
		if (this.isConnected) {
			return;
		}

		await this.adapter.connect();
		this.isConnected = true;

		if (this.options.debug) {
			console.log("Connected to the database");
		}
	}

	/**
	 * Disconnect from the database
	 */
	async disconnect(): Promise<void> {
		if (!this.isConnected) {
			return;
		}

		await this.adapter.disconnect();
		this.isConnected = false;

		if (this.options.debug) {
			console.log("Disconnected from the database");
		}
	}

	/**
	 * Execute a raw query
	 */
	async $executeRaw(query: string, ...values: any[]): Promise<number> {
		this.ensureConnected();

		if (this.options.log?.includes("query")) {
			console.log(`Executing raw query: ${query}`, values);
		}

		const result = await this.adapter.executeRaw(query, values);
		return result.data.length;
	}

	/**
	 * Execute a raw query and return the results
	 */
	async $queryRaw<T = any>(query: string, ...values: any[]): Promise<T[]> {
		this.ensureConnected();

		if (this.options.log?.includes("query")) {
			console.log(`Executing raw query: ${query}`, values);
		}

		const result = await this.adapter.executeRaw<T>(query, values);
		return result.data;
	}

	/**
	 * Execute multiple operations in a transaction
	 */
	async $transaction<T>(
		operationsOrFn: Promise<T>[] | ((tx: any) => Promise<T>),
		options?: TransactionClientOptions,
	): Promise<T[] | T> {
		this.ensureConnected();

		const txOptions: TransactionOptions = {
			isolationLevel: options?.isolationLevel,
			maxWait: options?.maxWait,
			timeout: options?.timeout,
		};

		if (typeof operationsOrFn === "function") {
			// Function-based transaction
			return this.adapter.transaction(operationsOrFn, txOptions);
		} else {
			// Array of operations
			return this.adapter.$transaction(
				operationsOrFn.map((p) => () => p),
				txOptions,
			);
		}
	}

	/**
	 * Get the underlying database adapter
	 */
	$getAdapter(): DatabaseAdapter {
		return this.adapter;
	}

	/**
	 * Extend the client with custom functionality
	 * This method creates a new client instance with the extension applied
	 */
	$extends(extensionOrExtensions: Extension | Extension[]): any {
		// Create a new client instance with the same options
		const newClient = Object.create(
			Object.getPrototypeOf(this),
			Object.getOwnPropertyDescriptors(this),
		);

		// Apply the extension(s)
		let result = newClient;
		if (Array.isArray(extensionOrExtensions)) {
			for (const extension of extensionOrExtensions) {
				result = applyExtension(result, extension);
			}
		} else {
			result = applyExtension(result, extensionOrExtensions);
		}

		return result;
	}

	/**
	 * Ensure the client is connected
	 * @throws Error if not connected
	 */
	protected ensureConnected(): void {
		if (!this.isConnected) {
			throw new Error(
				"Client is not connected to the database. Call connect() first.",
			);
		}
	}
}

// Add extension utilities to the Drismify namespace
export const Drismify = {
	/**
	 * Define an extension
	 */
	defineExtension,

	/**
	 * Get the extension context
	 */
	getExtensionContext,
};

// Export PrismaClient as an alias for DrismifyClient
// This allows compatibility with tests and code that expects the PrismaClient name
export const PrismaClient = DrismifyClient;
